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
| Resultados | TheSportsDB — `id=4429`, `season=2026` (free, tiene WC 2026) |
| Standings  | No sincronizados desde fuente externa (la integración con API-Football fue eliminada; se puede reimplementar en el futuro) |
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

### Schema en:
- `supabase/migrations/20260101000000_init.sql` (schema base)
- `supabase/migrations/20260102000000_add_porras.sql` (sistema multi-porra)

#### Tablas

```
profiles                  — extiende auth.users; auto-creado al hacer OAuth
porras                    — grupos de competición independientes; campo created_by
porra_members             — relación N:M entre porras y users; unique (porra_id, user_id)
teams                     — 48 equipos; campo api_football_id para joins con API-Football
matches                   — 104 partidos; result_ft calculado por trigger
group_standings           — 12 tablas de grupo; no sincronizado actualmente (la integración con API-Football fue eliminada)
predictions               — 1 fila por (porra_id, user_id, match_id); predicciones independientes por porra
golden_boot_predictions   — 1 fila por (porra_id, user_id); Bota de Oro independiente por porra
scoring_rules             — tabla de referencia inmutable; seed en la migración
scores                    — leaderboard por porra; PK es (porra_id, user_id); columnas total_points* son generated always
sync_logs                 — historial de sync con TheSportsDB
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
| `on_match_result_award_points` | `matches` | Concede puntos a todas las predicciones del partido (por porra) |
| `on_porra_created_add_creator` | `porras` | Añade automáticamente el creador como miembro |
| `on_porra_member_created_init_scores` | `porra_members` | Crea fila en `scores` (porra_id, user_id) al unirse |
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

## TheSportsDB (fuente de resultados)

- **Base URL:** `https://www.thesportsdb.com/api/v1/json`
- **Identificadores Mundial 2026:** `id=4429`, `season=2026`
- **Free tier:** key pública `'3'`; registra una cuenta free en thesportsdb.com para mayor cuota

### Endpoint utilizado

```
GET /eventsseason.php?id=4429&s=2026   → todos los fixtures del torneo (1 sola llamada)
```

### Lógica de sync (`lib/thesportsdb/sync.ts`)

```
1. getWorldCupFixtures() → todos los fixtures del Mundial (TheSportsDB, 1 call)
2. Filtrar por fecha si se pasa `date` (YYYY-MM-DD); si no, procesar todos (backfill)
3. Para cada fixture finished:
   - status FT   → buscar en DB por kickoff_at, UPDATE matches SET home_goals_ft, away_goals_ft, result_ft
   - status AET/PEN → SKIP + console.warn (TheSportsDB devuelve score post-prórroga; admin introduce el 90' manualmente)
4. El trigger on_match_result_award_points concede puntos (result_ft debe estar en el SET)
5. Registrar en sync_logs
```

## API-Football

La integración con API-Football fue eliminada (free tier no tiene acceso a resultados de 2026). Los resultados se obtienen de TheSportsDB. Los standings de grupo no se sincronizan actualmente desde ninguna fuente externa.

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

# TheSportsDB (fuente de resultados del torneo)
THESPORTSDB_KEY=3                 # '3' = key pública de test; registra una cuenta free para más cuota

# Seguridad cron
CRON_SECRET=                      # string aleatorio, mismo en Vercel y vercel.json

# Notificaciones de Discord (opcional) — ver lib/notify/CLAUDE.md
DISCORD_WEBHOOK_URL=              # webhook del canal; sin esta var el sync no notifica nada
GEMINI_API_KEY=                  # opcional; free tier (aistudio.google.com/apikey). Sin ella → plantilla fija
GEMINI_MODEL=gemini-2.0-flash    # opcional, default
```

### Notificaciones de Discord

Cuando el cron de sync (`/api/sync-matches`) hace terminar uno o más partidos, manda un mensaje a Discord con los resultados y el impacto en el ranking de cada porra. Si no acaba ningún partido en esa pasada, no envía nada. El texto lo redacta Gemini Flash (free tier) con fallback a plantilla fija. Es best-effort: nunca rompe el sync. Detalle en `lib/notify/CLAUDE.md`.

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
- [x] Módulo TheSportsDB (sync)
- [x] Seed script (openfootball)
- [x] Auth (OAuth Google/GitHub)
- [x] UI Porra 1 — grupos
- [x] UI Porra 2 — playoffs / bracket
- [x] UI Bota de Oro
- [x] Leaderboard en tiempo real
- [x] Importar predicciones de otra porra (al crear una porra en onboarding)
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

### 5. PowerShell y curl
En PowerShell de Windows, `curl` es un alias de `Invoke-WebRequest`, no el `curl` de Linux. Usar:
```powershell
Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/seed
```

### 6. Seed requiere env vars
El endpoint `/api/seed` valida `CRON_SECRET` antes de ejecutar. Sin ella da 500.

---

## Next Steps (TODO)

### 🔴 Bloqueantes — hacer antes de que funcione la app

#### 1. Configurar Google OAuth
1. Ir a [Google Cloud Console → Credenciales](https://console.cloud.google.com/apis/credentials)
2. Crear un proyecto (ej. `porra-mundial-2026`) si no existe
3. Ir a "Pantalla de consentimiento de OAuth" → Externo → rellenar datos mínimos
4. Crear "ID de cliente de OAuth" → Aplicación Web
5. En **URIs de redireccionamiento autorizados** poner:
   ```
   https://cnkkfxlswmagruahulfn.supabase.co/auth/v1/callback
   ```
6. Copiar **Client ID** y **Client Secret**
7. Ir a [Supabase Auth Providers](https://supabase.com/dashboard/project/cnkkfxlswmagruahulfn/auth/providers) → Google → Enable → pegar las credenciales → Save

#### 2. Configurar variables de entorno que faltan
Añadir al `.env.local`:
```env
# Generar un string aleatorio (ej. con openssl rand -hex 32)
CRON_SECRET=<un-string-aleatorio-largo>

# Obtener en Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

#### 3. Ejecutar el seed (con npm run dev corriendo)
```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/seed -Headers @{Authorization="Bearer TU_CRON_SECRET"}

# O usando curl real (Git Bash / WSL / Mac / Linux)
curl -X POST http://localhost:3000/api/seed -H "Authorization: Bearer TU_CRON_SECRET"
```

### 🟡 Pendientes del proyecto

#### 4. Aplicar migración en Supabase
La migración `20260102000000_add_porras.sql` añade las tablas `porras` y `porra_members`, modifica `predictions`, `scores` y `golden_boot_predictions` para ser por porra, y actualiza triggers y vistas. Aplicar con:
```bash
npx supabase db push
```
O pegar el fichero en el SQL Editor del Dashboard de Supabase.

Además, borrar todos los usuarios existentes en Supabase Dashboard → Authentication → Users para que el nuevo flujo de onboarding se active.

#### 5. Panel admin
Vista para:
- Ver y gestionar usuarios (cambiar roles)
- Ver `sync_logs` (historial de sincronizaciones)
- Forzar recálculo de puntos manualmente
- Marcar la Bota de Oro como acertada/fallida

#### 6. Deploy en Vercel
1. Conectar repo en [vercel.com](https://vercel.com)
2. Configurar todas las env vars (URL, keys, CRON_SECRET)
3. Crear `vercel.json` con el cron:
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
4. Deploy y verificar que el cron sincroniza resultados

### 🟢 Mejoras opcionales

- [ ] Manejo de errores visual cuando las tablas no existen (fallback UI en vez de pantalla vacía)
- [ ] Página de perfil de usuario (editar display_name, ver historial de predicciones)
- [ ] Notificaciones push cuando un partido termine y se asignen puntos
- [ ] Vista comparativa entre dos usuarios (head-to-head)
- [ ] Modo oscuro/claro toggle (actualmente solo dark)
- [ ] Gestión de miembros de porra (ver quién está, expulsar desde el panel admin de la porra)
