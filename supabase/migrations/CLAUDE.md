# Base de datos — `/supabase/migrations/`

## Qué hay aquí

Ocho migraciones:
- `20260101000000_init.sql` — schema base (tablas, enums, triggers, vistas, RLS)
- `20260102000000_add_porras.sql` — sistema multi-porra (ver sección "Porras" más abajo)
- `20260103000000_global_lock.sql` — bloqueo global de predicciones 1h antes del primer partido (2026-06-11 18:00 UTC) + RLS para revelar predicciones tras el cierre
- `20260104000000_fix_global_lock_award.sql` — fix crítico: el bloqueo global rechazaba el award de puntos del sistema (ver sección "Triggers")
- `20260105000000_idempotent_scoring.sql` — puntuación idempotente y recálculo atómico (ver sección "Triggers"). Arregla que los puntos pudieran **bajar** tras un recálculo a medias o por inflación del trigger aditivo.
- `20260106000000_fix_recompute_where_clause.sql` — fix: `recompute_all_scores()` tenía dos `UPDATE` sobre `scores` sin `WHERE` (reset por fase y bump de `updated_at`). La DB tiene safe-updates activado y los rechazaba → `/api/admin/recalculate` devolvía 500. Añade `where true`.
- `20260107000000_add_discord_user_id.sql` — añade `discord_user_id` a `profiles` para mencionar usuarios en las notificaciones de Discord.
- `20260108000000_unlock_playoff_predictions.sql` — reabre las predicciones de **eliminatorias** (el cuadro nunca se predijo antes del cierre global). Grupos siguen cerrados desde el 11 jun; las eliminatorias vuelven al bloqueo por kick-off de cada partido. Cambia la política RLS de INSERT y el trigger `lock_predictions_at_kickoff` para diferenciar por fase.

> ⚠️ **Aviso de historia:** hubo una colisión de timestamp `20260103000000`. Una migración previa (`_fix_prediction_lock.sql`) compartía versión con `_global_lock.sql`, así que `db push` la dio por aplicada y nunca se ejecutó en prod. Quedó superada por `20260104000000_fix_global_lock_award.sql`. **No reutilices un timestamp ya existente.**

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

## Porras (migración 20260102)

El sistema es multi-porra: cada usuario puede crear y unirse a múltiples porras. Las predicciones y puntuaciones son independientes por porra.

### Tablas nuevas

**`porras`** — grupos de competición
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID PK | — |
| `name` | text | Nombre de la porra |
| `created_by` | UUID FK → profiles | El creador es automáticamente admin y miembro |

**`porra_members`** — relación N:M
| Campo | Tipo | Descripción |
|---|---|---|
| `porra_id` | UUID FK → porras | — |
| `user_id` | UUID FK → profiles | — |
| `joined_at` | timestamptz | — |
| UNIQUE | `(porra_id, user_id)` | — |

### Cambios en tablas existentes

- **`predictions`**: UNIQUE ahora es `(porra_id, user_id, match_id)` (era `user_id, match_id`)
- **`golden_boot_predictions`**: UNIQUE ahora es `(porra_id, user_id)` (era `user_id`)
- **`scores`**: PK ahora es `(porra_id, user_id)` (era `user_id`)
- **Leaderboard views**: todas incluyen `porra_id` y usan `PARTITION BY porra_id` en el `ROW_NUMBER()`

### Triggers nuevos/actualizados

| Trigger | Tabla | Descripción |
|---|---|---|
| `on_porra_created_add_creator` | `porras` | Al crear una porra, añade el creador como miembro automáticamente |
| `on_porra_member_created_init_scores` | `porra_members` | Al unirse a una porra, crea fila en `scores` con todos los puntos a 0 |
| `award_points_on_result` | `matches` | Actualizado: ahora usa `v_pred.porra_id` para filtrar scores por porra |

### Flujo de porra activa

La porra activa se almacena en la cookie `active_porra_id` (no-httpOnly, 1 año). Se establece mediante el Server Action `app/actions/porra.ts → setActivePorra(porraId)`. Cada page.tsx la lee vía `lib/active-porra.ts → getActivePorraId()`.

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
**Cuándo:** Cuando `result_ft` cambia (NULL→valor o valor→valor distinto)
**Qué hace:** Recorre todas las predicciones del partido, marca `is_correct` y asigna `points_awarded` según la fase.
**⚠️ Fix `20260105` (idempotente):** antes era ADITIVO puro (`scores = scores + pts`), así que re-disparar el trigger o **corregir** un resultado inflaba los puntos sin restar lo ya concedido. Ahora aplica el **delta** (`nuevo_pts - points_awarded_previo`) por predicción, así que es idempotente: re-procesar o corregir un partido nunca duplica ni infla.

### `recompute_all_scores()` (función, no trigger)
**Qué hace:** Recálculo completo en **una sola transacción** (atómico). Recomputa `predictions.points_awarded/is_correct` desde los resultados actuales, resetea las columnas de puntos por fase de `scores` (preserva `points_golden_boot`) y re-agrega. La llama `/api/admin/recalculate` vía `rpc()`.
**Por qué:** el recálculo anterior (en JS, en el endpoint) reseteaba a 0 y luego actualizaba usuario por usuario con awaits sucesivos; si la función serverless se cortaba a medias dejaba los scores a 0 o parciales → "menos puntos que ayer". Al ser una transacción, si algo falla hace rollback y los scores quedan intactos.
**Disparador:** el GitHub Action `.github/workflows/sync-and-recalculate.yml` llama a `/api/admin/recalculate` cada 3 horas (red de seguridad), autenticándose con `Authorization: Bearer CRON_SECRET`. Por eso el endpoint acepta dos vías de auth: cron (CRON_SECRET) o sesión de admin. Con el recálculo no atómico previo, cada pasada era una oportunidad de dejar los scores corruptos; ahora es seguro.

### `enforce_prediction_lock`
**Tabla:** `predictions`
**Cuándo:** Antes de cualquier UPDATE
**Qué hace:** (función `lock_predictions_at_kickoff`) Lanza error si el usuario intenta cambiar su apuesta (`prediction`) una vez iniciado el torneo (bloqueo global, 2026-06-11 18:00 UTC) o cuando ya está bloqueada (`is_locked = true`). Última línea de defensa contra trampas.
**⚠️ Fix `20260104`:** El check solo se evalúa cuando cambia el campo `prediction`. El bloqueo global (`20260103_global_lock`) saltaba en *cualquier* UPDATE tras el inicio del torneo, lo que hacía rollback de `award_points_on_result` (que escribe `is_correct`/`points_awarded` tras finalizar el partido) → ningún partido guardaba resultado ni puntos. Los UPDATE del sistema no tocan `prediction`, así que ahora pasan.

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
