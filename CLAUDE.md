# CLAUDE.md

Contexto del proyecto para Claude. Lee este fichero antes de tocar cualquier cosa.

---

## Qué es esto

Aplicación web de porra del Mundial FIFA 2026 entre un grupo de amigos. Dos competiciones independientes (grupos + playoffs), sistema 1-X-2, bonus Bota de Oro, ranking automático en tiempo real.

**Repo:** https://github.com/niicogrc/worldcup-2026

---

## Stack

| Capa       | Tecnología                                              |
|------------|---------------------------------------------------------|
| Frontend   | Next.js 15 App Router + TypeScript + Tailwind CSS       |
| Auth       | Supabase Auth — OAuth Google y GitHub únicamente        |
| DB         | Supabase Postgres                                       |
| Realtime   | Supabase Realtime (leaderboard en vivo)                 |
| API datos  | API-Football api-sports.io — `league=1`, `season=2026`  |
| Seed       | openfootball/worldcup.json (fixtures estáticos, CC0)    |
| Deploy     | Vercel — frontend + cron jobs                           |

---

## Reglas de negocio críticas

### Sistema de puntuación

```
Grupos (72 partidos):      3 pts acierto, 0 fallo  → máx 216
Dieciseisavos (16):        3 pts acierto            → máx 48
Octavos (8):               4 pts acierto            → máx 32
Cuartos (4):               6 pts acierto            → máx 24
Semifinales (2):           8 pts acierto            → máx 16
3er puesto (1):            5 pts acierto            → máx 5
Final (1):                15 pts acierto            → máx 15
Bota de Oro:              15 pts acierto            → máx 15
─────────────────────────────────────────────────────
TOTAL MÁXIMO:                                         371 pts
```

### Qué cuenta como resultado

- **Solo el resultado a 90 minutos** (`score.fulltime` en API-Football, campo `home_goals_ft` / `away_goals_ft` en DB).
- En eliminatorias, si hay empate a 90' → resultado = `X`, aunque luego haya prórroga y penaltis. El ganador de la eliminatoria NO afecta a la porra.
- `match_result` enum: `'1'` (gana local), `'X'` (empate 90'), `'2'` (gana visitante).
- El campo `result_ft` en `matches` se calcula automáticamente por trigger al actualizar `home_goals_ft` / `away_goals_ft` con status `FT | AET | PEN`.

### Cierre de apuestas

- Cada predicción se bloquea en el momento exacto del kick-off (`matches.kickoff_at`).
- La Bota de Oro se bloquea antes del primer partido del torneo (11 jun 2026 ~18:55 UTC).
- Un trigger en Postgres impide modificar predicciones bloqueadas. El frontend también debe impedirlo, pero la fuente de verdad es la DB.

### Desempate

En caso de igualdad de puntos totales (en el orden indicado):
1. Más aciertos en rondas finales (final + semis + cuartos)
2. Acertar la Bota de Oro
3. Sorteo (manual)

Las vistas `leaderboard`, `leaderboard_groups` y `leaderboard_playoffs` ya implementan el desempate con `ROW_NUMBER() OVER (ORDER BY ...)`.

### Visibilidad de predicciones

- Un usuario solo ve sus propias predicciones **antes** del kick-off del partido.
- **Después** del kick-off, las predicciones de todos los usuarios son visibles (RLS implementado).
- La Bota de Oro se revela para todos a partir del 11 jun 2026 19:00 UTC.

---

## Base de datos

### Schema en: `supabase/migrations/20260101000000_init.sql`

#### Tablas

```
profiles                  — extiende auth.users; auto-creado al hacer OAuth
teams                     — 48 equipos; campo api_football_id para joins con API-Football
matches                   — 104 partidos; result_ft calculado por trigger
group_standings           — 12 tablas de grupo; sincronizado desde API-Football
predictions               — 1 fila por (user_id, match_id); unique constraint
golden_boot_predictions   — 1 fila por user_id; unique constraint
scoring_rules             — tabla de referencia inmutable; seed en la migración
scores                    — leaderboard; columnas total_points* son generated always
sync_logs                 — historial de sync con API-Football
```

#### Enums

```sql
match_result   → '1' | 'X' | '2'
match_status   → 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'P' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'SUSP' | 'ABD'
tournament_phase → 'group' | 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final'
user_role      → 'participant' | 'admin'
```

#### Triggers importantes

| Trigger | Tabla | Descripción |
|---------|-------|-------------|
| `on_auth_user_created` | `auth.users` | Crea perfil automáticamente al registrarse |
| `set_match_result_ft` | `matches` | Calcula `result_ft` al actualizar goles |
| `on_match_result_award_points` | `matches` | Concede puntos a todas las predicciones del partido |
| `enforce_prediction_lock` | `predictions` | Bloquea edición tras kick-off |
| `on_profile_created_init_scores` | `profiles` | Inicializa fila en `scores` |

#### Vistas

| Vista | Descripción |
|-------|-------------|
| `leaderboard` | Ranking general con desempate |
| `leaderboard_groups` | Solo Porra 1 |
| `leaderboard_playoffs` | Solo Porra 2 |
| `match_predictions_summary` | Stats 1/X/2 por partido (% visible post kick-off) |

---

## API-Football

- **Base URL:** `https://v3.football.api-sports.io`
- **Auth header:** `x-apisports-key: <API_FOOTBALL_KEY>`
- **Identificadores Mundial 2026:** `league=1`, `season=2026`
- **Free tier:** 100 requests/día; reset a las 00:00 UTC

### Endpoints utilizados

```
GET /fixtures?league=1&season=2026&date=YYYY-MM-DD   → partidos del día
GET /fixtures?league=1&season=2026                   → todos los fixtures
GET /standings?league=1&season=2026                  → tablas de grupo
GET /players/topscorers?league=1&season=2026         → goleadores (Bota de Oro)
```

### Campos clave de /fixtures

```typescript
fixture.id            // → matches.api_football_id
fixture.date          // → matches.kickoff_at (ISO UTC)
fixture.status.short  // → matches.status (enum match_status)
fixture.venue.name    // → matches.venue
fixture.venue.city    // → matches.city
goals.home            // → matches.home_goals_ft (solo si status FT)
goals.away            // → matches.away_goals_ft
score.fulltime.home   // alternativa más explícita
score.fulltime.away
score.extratime.home  // → matches.home_goals_aet
score.penalty.home    // → matches.home_goals_pen
teams.home.id         // → teams.api_football_id (para join)
teams.home.name
league.round          // → inferir phase y match_number
```

### Lógica de sync (`lib/api-football/sync.ts`)

```
1. GET /fixtures?league=1&season=2026&date=<hoy>
2. Para cada fixture con status en [FT, AET, PEN]:
   a. Buscar match en DB por api_football_id
   b. Si home_goals_ft es null → UPDATE matches SET home_goals_ft, away_goals_ft, status, last_synced_at
   c. El trigger set_match_result_ft calcula result_ft
   d. El trigger on_match_result_award_points concede puntos
3. Actualizar group_standings si ha cambiado
4. Registrar en sync_logs
```

### Presupuesto de llamadas

```
Partidos del día:    1 call  (durante el torneo, max 8 partidos/día)
Standings:           1 call  (solo fase de grupos, ~15 días)
Top scorers:         1 call  (cada 4h, no cada hora)
─────────────────────────────────────────────────────
Máx por ejecución:   3 calls × 24 ejecuciones/día = 72 calls/día
Free tier:           100 calls/día
Margen:              28 calls de seguridad
```

---

## Seed inicial

**Script:** `app/api/seed/route.ts`  
**Fuente:** `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`

El seed hace:
1. Inserta los 48 equipos en `teams`
2. Inserta los 104 fixtures en `matches` con `kickoff_at` en UTC
3. Marca `status = 'NS'` en todos

**Importante:** openfootball usa horas locales (UTC-4/UTC-5/UTC-6/UTC-7 según ciudad). El seed debe convertir a UTC antes de insertar.

---

## Cron job

**Endpoint:** `POST /api/sync-matches`  
**Vercel config** (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/sync-matches",
      "schedule": "5 * * * *"
    }
  ]
}
```

El endpoint valida el header `Authorization: Bearer <CRON_SECRET>` antes de ejecutar.

---

## Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo en server-side / API routes

# API-Football
API_FOOTBALL_KEY=                 # nunca exponer al cliente

# Seguridad cron
CRON_SECRET=                      # string aleatorio, mismo en Vercel y vercel.json
```

---

## Convenciones de código

- **Rutas de App Router:** todo en `app/`, sin `pages/`
- **Server Components por defecto.** Usar `"use client"` solo cuando sea necesario (interacción, hooks de estado)
- **Supabase client:** usar `lib/supabase/server.ts` en Server Components y API routes; `lib/supabase/client.ts` en Client Components
- **Service role key:** solo en API routes server-side (`/api/*`), nunca en el cliente
- **Tipos de DB:** generados con `supabase gen types typescript` en `lib/supabase/types.ts`
- **Tailwind:** sin CSS modules; todo con clases de Tailwind + `cn()` para condicionales

---

## Torneo — Datos de referencia

```
Formato:     48 equipos, 12 grupos de 4, 32avos (top 2 × 12 + 8 mejores terceros)
Inicio:      11 jun 2026 — México vs Sudáfrica — 19:00 UTC
Final:       19 jul 2026 — MetLife Stadium, East Rutherford (New Jersey) — 19:00 UTC
Duración:    39 días, 104 partidos
Sedes:       16 estadios en USA, México y Canadá (UTC-4 a UTC-7)
```

---

## Estado del proyecto

- [x] Reglas de la porra definidas
- [x] Stack decidido
- [x] Schema SQL completo (con triggers, RLS, vistas)
- [x] Estructura Next.js
- [x] Módulo API-Football (sync)
- [x] Seed script (openfootball)
- [x] Auth (OAuth Google/GitHub)
- [x] UI Porra 1 — grupos
- [x] UI Porra 2 — playoffs / bracket
- [x] UI Bota de Oro
- [x] Leaderboard en tiempo real
- [ ] Panel admin
- [ ] Deploy en Vercel

---

## Aprendizajes (Learnings & Gotchas)

### 1. Prerenderizado en Next.js 15 y Supabase SSR
Durante la compilación (`next build`), Next.js intenta prerenderizar las páginas estáticas (como `/login`). Si el cliente de Supabase se inicializa en el cuerpo del componente leyendo `process.env.NEXT_PUBLIC_SUPABASE_URL` y este no está presente en el entorno de compilación, arrojará un error fatal.
* **Solución:** Proveer URLs y claves placeholder seguras (e.g., `'https://placeholder.supabase.co'`) como fallback para evitar caídas durante el prerenderizado.

### 2. Dependencias de `@g-loot/react-tournament-brackets`
El componente de brackets requiere de dependencias adicionales no declaradas explícitamente en su instalación inicial.
* **Solución:** Instalar manualmente `styled-components` y `react-svg-pan-zoom` utilizando `--legacy-peer-deps`.

### 3. Inferencia de Tipos de Supabase (TypeScript)
Realizar consultas con select restringido (como `.select('kickoff_at')`) o invocar `.single()` en consultas específicas puede hacer que el compilador de TypeScript reduzca el tipo del resultado a `never` o `never[]`.
* **Solución:** Utilizar `.select('*')`, `.maybeSingle()` para mayor tolerancia a filas nulas, y realizar casts explícitos a `any` en las propiedades afectadas.

### 4. Literales en Framer Motion
Los objetos de variantes de Framer Motion infieren strings generales para las propiedades de transición (e.g. `type: 'spring'`). El compilador de TypeScript rechaza esto, exigiendo tipos literales.
* **Solución:** Definir los objetos de animación con la directiva `as const` o type cast específico (`'spring' as const`).
