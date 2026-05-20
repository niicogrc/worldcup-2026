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
| Estilos         | Tailwind CSS                        |
| Backend / DB    | Supabase (Postgres + Auth + Realtime)|
| Autenticación   | Supabase Auth — OAuth Google/GitHub  |
| API de datos    | API-Football (`api-sports.io`)       |
| Datos estáticos | openfootball/worldcup.json (seed)    |
| Deploy          | Vercel (frontend + cron jobs)        |

---

## Estructura del proyecto

```
worldcup-2026/
├── app/
│   ├── (auth)/
│   │   └── login/                  # Página de login OAuth
│   ├── (app)/
│   │   ├── layout.tsx              # Layout autenticado
│   │   ├── dashboard/              # Ranking general
│   │   ├── grupos/                 # 72 partidos fase grupos
│   │   │   └── [matchId]/          # Detalle de partido
│   │   ├── playoffs/               # Bracket eliminatoria
│   │   │   └── [matchId]/
│   │   └── bota-de-oro/            # Apuesta al goleador
│   └── api/
│       ├── sync-matches/           # Cron: sync desde API-Football
│       ├── calculate-scores/       # Recalcular puntos (manual/admin)
│       └── seed/                   # Seed inicial desde openfootball
├── components/
│   ├── ui/                         # Componentes base (shadcn/ui)
│   ├── match-card.tsx
│   ├── prediction-buttons.tsx      # Botones 1 / X / 2
│   ├── leaderboard-table.tsx
│   └── bracket.tsx                 # Bracket visual de eliminatorias
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Cliente browser
│   │   ├── server.ts               # Cliente server (SSR)
│   │   └── types.ts                # Tipos generados del schema
│   └── api-football/
│       ├── client.ts               # Wrapper axios para api-sports.io
│       ├── sync.ts                 # Lógica de sincronización
│       └── types.ts                # Tipos de respuesta de la API
├── supabase/
│   └── migrations/
│       └── 20260101000000_init.sql # Schema completo
└── vercel.json                     # Config crons
```

---

## Base de datos

Schema completo en `supabase/migrations/20260101000000_init.sql`.

### Tablas principales

| Tabla                      | Descripción                                              |
|----------------------------|----------------------------------------------------------|
| `profiles`                 | Usuarios (extiende `auth.users`)                         |
| `teams`                    | 48 selecciones con su `api_football_id`                  |
| `matches`                  | 104 partidos — resultado a 90', prórroga y penales       |
| `group_standings`          | Clasificación en tiempo real de los 12 grupos            |
| `predictions`              | Predicciones 1/X/2 por usuario y partido                 |
| `golden_boot_predictions`  | Apuesta al máximo goleador (1 por usuario)               |
| `scoring_rules`            | Puntos por fase (referencia inmutable, seed incluido)    |
| `scores`                   | Leaderboard con puntos desglosados por fase              |
| `sync_logs`                | Historial de sincronizaciones con API-Football           |

### Vistas

| Vista                        | Descripción                                              |
|------------------------------|----------------------------------------------------------|
| `leaderboard`                | Ranking general con desempate aplicado                   |
| `leaderboard_groups`         | Ranking solo Porra 1 (grupos)                            |
| `leaderboard_playoffs`       | Ranking solo Porra 2 (playoffs)                          |
| `match_predictions_summary`  | Estadísticas 1/X/2 por partido (% visible tras kick-off) |

### Lógica automática (triggers)

- Auto-crear perfil al registrarse con OAuth
- Calcular `result_ft` al actualizar goles en `matches`
- **Conceder puntos automáticamente** a todas las predicciones al resolver un partido
- Bloquear predicciones al kick-off
- Inicializar `scores` al crear un perfil

---

## API de datos — API-Football

- **Provider:** [api-sports.io](https://api-sports.io)
- **Identificadores:** `league=1`, `season=2026`
- **Free tier:** 100 requests/día (uso real: ~30-50/día con el cron horario)

### Endpoints utilizados

```
GET /fixtures?league=1&season=2026&date=<YYYY-MM-DD>   # partidos del día
GET /standings?league=1&season=2026                    # tablas de grupo
GET /players/topscorers?league=1&season=2026           # Bota de Oro
```

### Cron de sincronización

Un cron job en Vercel ejecuta `POST /api/sync-matches` cada hora durante el torneo (11 jun – 19 jul 2026). El cron:

1. Consulta los partidos del día a API-Football
2. Actualiza `matches` con resultado, estado y hora de sync
3. El trigger de Postgres calcula `result_ft` y concede puntos automáticamente
4. Registra la operación en `sync_logs`

---

## Datos estáticos — openfootball

- **Repo:** [openfootball/worldcup.json](https://github.com/openfootball/worldcup.json)
- **URL:** `https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json`
- **Uso:** seed inicial de los 104 fixtures, grupos, equipos y horarios

> No usar como fuente de resultados en tiempo real (actualización manual por la comunidad, delay no garantizado).

---

## Instalación y configuración

### Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com) (free tier)
- Cuenta en [API-Football](https://dashboard.api-football.com/register) (free tier)
- Cuenta en [Vercel](https://vercel.com) (free tier)

### Variables de entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# API-Football
API_FOOTBALL_KEY=<tu-api-key>

# Cron (token secreto para proteger el endpoint)
CRON_SECRET=<random-string>
```

### Setup inicial

```bash
# 1. Clonar el repo
git clone https://github.com/niicogrc/worldcup-2026.git
cd worldcup-2026

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# → rellenar con tus credenciales

# 4. Aplicar el schema en Supabase
# Opción A: pegar supabase/migrations/20260101000000_init.sql en el SQL Editor
# Opción B: con Supabase CLI
npx supabase db push

# 5. Ejecutar el seed inicial (fixtures + equipos desde openfootball)
curl -X POST http://localhost:3000/api/seed \
  -H "Authorization: Bearer $CRON_SECRET"

# 6. Arrancar en desarrollo
npm run dev
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
