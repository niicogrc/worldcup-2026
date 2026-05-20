# 🏆 Porra Mundial 2026

Aplicación web para gestionar una porra del Mundial FIFA 2026 entre amigos. Dos competiciones independientes (fase de grupos y playoffs), sistema de puntuación 1-X-2, bonus Bota de Oro y ranking en tiempo real.

## Reglas de la porra

### Porra 1 — Fase de grupos
Predices el resultado (1, X o 2) de los **72 partidos** de la fase de grupos.

| Resultado | Puntos |
|-----------|--------|
| Acierto   | 3 pts  |
| Fallo     | 0 pts  |

**Máximo: 216 puntos**

#### Bonus Bota de Oro
Apuesta al máximo goleador del Mundial antes del primer partido. Se entrega al inicio, se cobra al final.

| Resultado | Puntos |
|-----------|--------|
| Acierto   | 15 pts |

---

### Porra 2 — Playoffs
Empieza cuando acaban los grupos y se conocen los 32 clasificados a dieciseisavos.

| Fase          | Puntos por acierto | Partidos | Máximo |
|---------------|--------------------|----------|--------|
| Dieciseisavos | 3 pts              | 16       | 48 pts |
| Octavos       | 4 pts              | 8        | 32 pts |
| Cuartos       | 6 pts              | 4        | 24 pts |
| Semifinales   | 8 pts              | 2        | 16 pts |
| 3er puesto    | 5 pts              | 1        | 5 pts  |
| Final         | 15 pts             | 1        | 15 pts |

**Máximo: 140 puntos**

> ⚠️ En eliminatorias, "X" cuenta si hay empate en los **90 minutos**. Quién clasifique por prórroga o penaltis no afecta a la porra.

---

### Puntuación total
| Porra        | Máximo     |
|--------------|------------|
| Grupos       | 216 pts    |
| Playoffs     | 140 pts    |
| Bota de Oro  | 15 pts     |
| **TOTAL**    | **371 pts**|

---

### Reglas generales

**Plazos:**
- Cada predicción se cierra al pitido inicial del partido
- Si no introduces tu predicción a tiempo → 0 puntos en ese partido
- La Bota de Oro debe apostarse antes del primer partido del Mundial (11 jun 2026)

**Premios:**
- Premio al ganador de la Porra 1 (grupos)
- Premio al ganador de la Porra 2 (playoffs)
- Premio al campeón general (suma de las dos + bota)

**Desempate** (en caso de igualdad de puntos):
1. Más aciertos en rondas finales (final, semis, cuartos)
2. Acertar la Bota de Oro
3. Sorteo

---

## Stack técnico

| Capa            | Tecnología                          |
|-----------------|-------------------------------------|
| Frontend        | Next.js 15 (App Router) + TypeScript |
| Estilos         | Tailwind CSS v4                     |
| Tipografías     | Bebas Neue + Oswald + Inter         |
| Animaciones     | Framer Motion                       |
| Backend / DB    | Supabase (Postgres + Auth + Realtime)|
| Autenticación   | Supabase Auth — OAuth Google/GitHub  |
| API de datos    | API-Football (`api-sports.io`)       |
| Brackets        | @g-loot/react-tournament-brackets   |
| Deploy          | Vercel (frontend + cron jobs)        |

---

## Estructura del proyecto (real)

```
worldcup-2026/
├── app/
│   ├── layout.tsx                     # Root layout (fuentes, metadata)
│   ├── page.tsx                       # Landing / redirect
│   ├── globals.css                    # Sistema de diseño (glassmorphism, glow, etc.)
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx               # Login OAuth (Google/GitHub) con Framer Motion
│   ├── (app)/
│   │   ├── layout.tsx                 # Layout autenticado (sidebar + navbar + avatar)
│   │   ├── navigation.tsx             # Navegación desktop/mobile con active states
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # Server Component: fetch leaderboard
│   │   │   └── leaderboard-client.tsx # Client: tabla + Supabase Realtime
│   │   ├── grupos/
│   │   │   ├── page.tsx               # Server Component: fetch matches + predictions
│   │   │   └── groups-client.tsx      # Client: filtro por grupo, botones 1/X/2
│   │   ├── playoffs/
│   │   │   ├── page.tsx               # Server Component: fetch bracket matches
│   │   │   └── playoffs-client.tsx    # Client: bracket interactivo SVG
│   │   └── bota-de-oro/
│   │       ├── page.tsx               # Server Component: fetch prediction + teams
│   │       └── golden-boot-client.tsx # Client: formulario + countdown timer
│   ├── api/
│   │   ├── predictions/route.ts       # POST: guardar/actualizar predicción 1/X/2
│   │   ├── golden-boot/route.ts       # POST: guardar predicción Bota de Oro
│   │   ├── seed/route.ts              # POST: importar equipos y fixtures de API-Football
│   │   └── sync-matches/route.ts      # POST: cron horario, sync resultados
│   └── auth/
│       └── callback/route.ts          # OAuth code → session exchange
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # createBrowserClient (Client Components)
│   │   ├── server.ts                  # createServerClient + createAdminClient
│   │   └── types.ts                   # Tipos generados del schema de Supabase
│   └── api-football/
│       ├── client.ts                  # Wrapper HTTP para api-sports.io
│       └── sync.ts                    # Lógica de sincronización matches → DB
├── utils/supabase/                    # Clientes alternativos (Supabase dashboard setup)
│   ├── client.ts
│   ├── server.ts
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       └── 20260101000000_init.sql    # ⭐ Schema completo (tablas + triggers + vistas + RLS)
├── middleware.ts                       # Auth guard: protege rutas (app) y redirige
├── declarations.d.ts                   # Declaración de módulos sin tipos
├── CLAUDE.md                           # Contexto completo del proyecto para AI
├── JUNIOR.md                           # Guía de buenas prácticas para juniors
└── vercel.json                         # Config crons de Vercel
```

---

## 🗄️ Base de datos — Setup completo

Los errores tipo `Could not find the table 'public.matches'` significan que **las tablas no existen todavía** en tu proyecto de Supabase. Necesitas ejecutar la migración SQL.

### Opción 1: SQL Editor de Supabase (recomendada)

1. Ve al **[SQL Editor de Supabase](https://supabase.com/dashboard/project/cnkkfxlswmagruahulfn/sql/new)**.
2. Copia y pega **todo** el contenido del archivo `supabase/migrations/20260101000000_init.sql`.
3. Haz clic en **Run** (Ejecutar).
4. Deberías ver mensajes de éxito confirmando la creación de tablas, triggers y vistas.

### Opción 2: Supabase CLI (si lo tienes instalado)

```bash
# 1. Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# 2. Linkear tu proyecto
npx supabase link --project-ref cnkkfxlswmagruahulfn

# 3. Ejecutar las migraciones
npx supabase db push
```

### Verificar que todo está bien

Después de ejecutar la migración, puedes verificar en el [Table Editor](https://supabase.com/dashboard/project/cnkkfxlswmagruahulfn/editor) que existen estas tablas:

| Tabla | Filas esperadas |
|-------|----------------|
| `profiles` | 0 (se llena al hacer login) |
| `teams` | 0 (se llena con el seed) |
| `matches` | 0 (se llena con el seed) |
| `group_standings` | 0 (se llena con sync) |
| `predictions` | 0 (se llena al predecir) |
| `golden_boot_predictions` | 0 (se llena al predecir) |
| `scoring_rules` | **7** (se llena automáticamente con la migración) |
| `scores` | 0 (se llena al hacer login) |
| `sync_logs` | 0 (se llena con sync) |

Y estas vistas:

| Vista | Propósito |
|-------|-----------|
| `leaderboard` | Ranking general con criterios de desempate |
| `leaderboard_groups` | Ranking solo Porra 1 |
| `leaderboard_playoffs` | Ranking solo Porra 2 |
| `match_predictions_summary` | Estadísticas 1/X/2 por partido |

### Seed: cargar equipos y partidos

Una vez las tablas existen, necesitas cargar los datos iniciales (equipos y fixtures):

```bash
# Ejecutar con el servidor de desarrollo corriendo
curl -X POST http://localhost:3000/api/seed
```

O simplemente abre en tu navegador: `http://localhost:3000/api/seed` (hace un POST automáticamente si usas herramientas como Postman o Thunder Client).

---

## Tablas — Detalle del schema

### `profiles`
Extiende `auth.users` de Supabase. Se crea automáticamente por trigger cuando un usuario hace OAuth.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid (PK) | Mismo que `auth.users.id` |
| `display_name` | text | Nombre del usuario (desde Google/GitHub) |
| `avatar_url` | text | URL del avatar |
| `role` | user_role | `'participant'` o `'admin'` |

### `teams`
Las 48 selecciones del Mundial 2026.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid (PK) | ID interno |
| `api_football_id` | integer (unique) | ID en API-Football para joins |
| `name` | text | Nombre en inglés (`"Spain"`) |
| `short_code` | text | Código FIFA 3 letras (`"ESP"`) |
| `group_letter` | char(1) | `'A'` – `'L'` |

### `matches`
Los 104 partidos del torneo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | uuid (PK) | ID interno |
| `api_football_id` | integer | ID del fixture en API-Football |
| `phase` | tournament_phase | `'group'`, `'round_of_16'`, etc. |
| `match_number` | integer | 1–104, orden FIFA |
| `home_team_id` / `away_team_id` | uuid (FK) | Equipos |
| `kickoff_at` | timestamptz | Hora de inicio (UTC) — **cierre de apuestas** |
| `status` | match_status | `'NS'`, `'FT'`, `'AET'`, etc. |
| `home_goals_ft` / `away_goals_ft` | integer | Goles a 90 min |
| `result_ft` | match_result | **Calculado por trigger**: `'1'`, `'X'`, `'2'` |

### `predictions`
Una predicción por usuario y partido.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `user_id` | uuid (FK) | Quién predijo |
| `match_id` | uuid (FK) | Qué partido |
| `prediction` | match_result | `'1'`, `'X'`, `'2'` |
| `is_correct` | boolean | null hasta que haya resultado, luego true/false |
| `points_awarded` | integer | 0 o N según la fase |

### `scores`
Leaderboard acumulado. Columnas `total_points*` son `GENERATED ALWAYS AS ... STORED`.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `user_id` | uuid (PK) | |
| `points_group` | integer | Puntos acumulados fase de grupos |
| `points_round_of_16` | integer | Puntos acumulados octavos |
| `total_points` | integer (generated) | Suma total automática |

---

## Triggers automáticos

| Trigger | Tabla | Qué hace |
|---------|-------|----------|
| `on_auth_user_created` | `auth.users` | Crea perfil en `profiles` al hacer OAuth |
| `on_profile_created_init_scores` | `profiles` | Crea fila en `scores` al crear perfil |
| `set_match_result_ft` | `matches` | Calcula `result_ft` al actualizar goles |
| `on_match_result_award_points` | `matches` | Concede puntos a predicciones del partido |
| `enforce_prediction_lock` | `predictions` | Bloquea edición tras kick-off |

---

## Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# API-Football
API_FOOTBALL_KEY=<tu-api-key>

# Cron (token secreto para proteger el endpoint)
CRON_SECRET=<random-string>
```

---

## Setup inicial

```bash
# 1. Clonar el repo
git clone https://github.com/niicogrc/worldcup-2026.git
cd worldcup-2026

# 2. Instalar dependencias
npm install --legacy-peer-deps

# 3. Configurar variables de entorno
cp .env.example .env.local
# → rellenar con tus credenciales

# 4. Crear las tablas en Supabase
# → Copiar supabase/migrations/20260101000000_init.sql en el SQL Editor de Supabase y ejecutar

# 5. Arrancar en desarrollo
npm run dev

# 6. Ejecutar el seed inicial (con el server corriendo)
curl -X POST http://localhost:3000/api/seed
```

---

## Torneo — Fechas clave

| Hito                              | Fecha (UTC)              |
|-----------------------------------|--------------------------|
| Primer partido (México vs Sudáfrica) | 11 jun 2026, 19:00 UTC |
| Cierre Bota de Oro                | 11 jun 2026, 18:55 UTC   |
| Fin fase de grupos                | ~26 jun 2026             |
| Inicio dieciseisavos              | ~28 jun 2026             |
| Final                             | 19 jul 2026, 19:00 UTC   |

---

## Contribuir

Proyecto privado para uso entre amigos. Issues y PRs bienvenidos de los participantes.
