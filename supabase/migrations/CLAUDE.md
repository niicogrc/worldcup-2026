# Base de datos — `/supabase/migrations/`

## Qué hay aquí

La migración inicial (`20260101000000_init.sql`) contiene el schema completo de la aplicación: tablas, enums, triggers, vistas y políticas RLS. Es el documento más importante de la infraestructura de datos.

---

## Cómo aplicar las migraciones

```bash
# Con Supabase CLI (recomendado)
npx supabase db push

# O directamente en el SQL Editor del Dashboard de Supabase
```

---

## Enums

```sql
match_result    → '1' (local gana) | 'X' (empate) | '2' (visitante gana)
match_status    → 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'P' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'SUSP' | 'ABD'
tournament_phase → 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'
user_role       → 'participant' | 'admin'
```

---

## Tablas principales

### `profiles`
Extiende `auth.users` de Supabase. Se crea automáticamente al registrarse (trigger). No usar INSERT manual.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID (FK → auth.users) | ID del usuario en Supabase Auth |
| `display_name` | text | Nombre en el leaderboard |
| `avatar_url` | text | URL de la foto de perfil |
| `role` | user_role | `'participant'` (por defecto) o `'admin'` |

### `teams`
48 equipos del torneo. Insertados por el seed.

| Campo | Tipo | Descripción |
|---|---|---|
| `name` | text UNIQUE | Nombre en inglés (openfootball) |
| `short_code` | text | Código FIFA (ej. 'ESP') |
| `group_letter` | text | 'A' a 'L' |
| `api_football_id` | integer | ID en API-Football (para joins) |
| `flag_url` | text | URL de la bandera (opcional) |

### `matches`
104 partidos del torneo. Insertados por el seed; actualizados por el sync.

| Campo | Tipo | Descripción |
|---|---|---|
| `api_football_id` | integer UNIQUE | ID en API-Football (puede ser sintético) |
| `match_number` | integer | Número de partido (1–104) |
| `phase` | tournament_phase | Fase del torneo |
| `group_letter` | text | Solo para fase de grupos |
| `home_team_id` / `away_team_id` | UUID FK → teams | Pueden ser NULL en playoffs TBD |
| `kickoff_at` | timestamptz | Inicio del partido en UTC |
| `status` | match_status | Estado actual del partido |
| `home_goals_ft` / `away_goals_ft` | integer | Goles a 90 minutos |
| `result_ft` | match_result | Calculado automáticamente por trigger |

### `predictions`
Una fila por (user_id, match_id). UNIQUE constraint en ambos campos.

| Campo | Tipo | Descripción |
|---|---|---|
| `user_id` | UUID FK → profiles | El usuario |
| `match_id` | UUID FK → matches | El partido |
| `prediction` | match_result | '1', 'X' o '2' |
| `is_locked` | boolean | true tras el kick-off |
| `is_correct` | boolean | Calculado por trigger al finalizar el partido |
| `points_awarded` | integer | Puntos obtenidos (0 o según la ronda) |

### `golden_boot_predictions`
Una fila por user_id. UNIQUE constraint.

### `scores`
Una fila por usuario. Los campos `total_points*` son columnas GENERATED ALWAYS (Postgres las calcula automáticamente, no se pueden insertar manualmente).

### `group_standings`
Clasificación por grupo. Actualizada por el sync de standings desde API-Football.

### `sync_logs`
Historial de ejecuciones del cron job. Útil para depurar si algo falla.

---

## Triggers importantes

### `on_auth_user_created`
**Tabla:** `auth.users` (de Supabase)
**Cuándo:** Al registrarse un nuevo usuario por OAuth
**Qué hace:** Crea automáticamente una fila en `profiles` con el nombre y avatar del proveedor

### `set_match_result_ft`
**Tabla:** `matches`
**Cuándo:** Al actualizar `home_goals_ft` o `away_goals_ft`
**Qué hace:** Calcula y guarda `result_ft` ('1', 'X' o '2') automáticamente

### `on_match_result_award_points`
**Tabla:** `matches`
**Cuándo:** Cuando `result_ft` cambia de NULL a un valor
**Qué hace:** Recorre todas las predicciones del partido, marca `is_correct` y asigna `points_awarded` según la fase

### `enforce_prediction_lock`
**Tabla:** `predictions`
**Cuándo:** Antes de cualquier UPDATE
**Qué hace:** Lanza error si la predicción ya está bloqueada (`is_locked = true`). Última línea de defensa contra trampas.

### `on_profile_created_init_scores`
**Tabla:** `profiles`
**Cuándo:** Al crear un nuevo perfil
**Qué hace:** Inserta una fila en `scores` para el nuevo usuario (todos los puntos a 0)

---

## Vistas

### `leaderboard`
Ranking completo con desempate aplicado:
1. Mayor `total_points`
2. Mayor puntos en rondas finales (cuartos + semis + final)
3. Tiene `points_golden_boot > 0`
4. Posición aleatoria (ROW_NUMBER con ORDER BY estable)

### `leaderboard_groups` / `leaderboard_playoffs`
Ranking solo para Porra 1 (grupos) o Porra 2 (playoffs).

### `match_predictions_summary`
Porcentaje de predicciones 1/X/2 por partido. Solo visible después del kick-off (RLS).

---

## RLS (Row Level Security)

Todas las tablas tienen RLS habilitado. Reglas clave:

- **predictions:** Un usuario solo ve sus propias predicciones antes del kick-off. Después, las de todos son visibles.
- **golden_boot_predictions:** Las tuyas siempre. Las de los demás solo a partir del inicio del torneo.
- **profiles / scores:** Lectura pública, escritura solo el propio usuario.
- **matches / teams / group_standings / scoring_rules:** Lectura pública para todos.
