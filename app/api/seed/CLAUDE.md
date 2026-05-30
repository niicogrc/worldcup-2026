# API — Seed — `/app/api/seed/`

## Qué hace este endpoint

Pobla la base de datos con los 48 equipos y los 104 partidos del Mundial 2026. Se ejecuta una sola vez antes del torneo. Los datos vienen de openfootball (CC0, open data).

---

## Endpoint

```
POST /api/seed
Header: Authorization: Bearer <CRON_SECRET>
```

Protegido con el mismo CRON_SECRET que el endpoint de sync (evita ejecuciones accidentales).

---

## Fuente de datos

```
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

Openfootball usa horas locales con offset UTC (ej: `"13:00 UTC-6"`). El seed convierte todas las horas a UTC antes de insertar.

---

## Lógica paso a paso

```
1. Valida Authorization header
2. Fetch openfootball JSON → array de matches
3. Extrae equipos únicos solo de la fase de grupos (los de eliminatorias son TBD)
4. Upsert de equipos (onConflict: 'name')
5. Upsert de partidos (onConflict: 'api_football_id')
6. Devuelve { teamsInserted, matchesInserted }
```

---

## Parsing de horarios

Los kickoffs en openfootball tienen el formato `"date": "2026-06-11", "time": "13:00 UTC-6"`. La función `parseKickoffUTC` convierte esto a ISO UTC:

```typescript
function parseKickoffUTC(date: string, time: string): string {
  // Extrae el offset (ej. -6)
  // Resta el offset a la hora para obtener UTC
  // Devuelve string ISO: "2026-06-11T19:00:00.000Z"
}
```

Las sedes del Mundial 2026 están en USA (UTC-4 a UTC-7), México y Canadá.

---

## Equipos TBD en eliminatorias

Los equipos en las rondas de eliminatorias tienen nombres codificados (`"2A"`, `"W89"`, `"L90"`) que representan "el segundo del grupo A", "el ganador del partido 89", etc. La función `isTBD(name)` los detecta y los ignora:

```typescript
function isTBD(name: string): boolean {
  return /^[0-9WL]/.test(name)
}
```

Estos partidos se insertan sin `home_team_id` o `away_team_id` (quedan como NULL hasta que avance el torneo).

---

## IDs sintéticos de API-Football

El campo `api_football_id` en `matches` es NOT NULL en el schema. Sin embargo, API-Football no siempre tiene acceso a datos de `season=2026` en el free tier. El seed usa IDs sintéticos (90001 a 90104) como placeholders:

```typescript
const syntheticApiId = 90001 + i
```

Cuando API-Football publique los IDs reales, habrá que actualizar estos valores para que el sync funcione.

---

## Mapping de fases

La función `mapRoundToPhase(round)` convierte el texto del round de openfootball a los valores del enum `tournament_phase`:

| Texto openfootball | Fase en DB |
|---|---|
| `"Matchday 1"`, `"Group A"` | `'group'` |
| `"Round of 32"` | `'round_of_32'` |
| `"Round of 16"` | `'round_of_16'` |
| `"Quarter-finals"` | `'quarter_final'` |
| `"Semi-finals"` | `'semi_final'` |
| `"Third place"`, `"3rd place"` | `'third_place'` |
| `"Final"` | `'final'` |

---

## Cómo ejecutar el seed

```bash
# Mac / Linux
curl -X POST http://localhost:3000/api/seed \
  -H "Authorization: Bearer TU_CRON_SECRET"

# PowerShell (Windows)
Invoke-WebRequest -Method POST -Uri http://localhost:3000/api/seed `
  -Headers @{Authorization="Bearer TU_CRON_SECRET"}
```

El servidor de desarrollo debe estar corriendo (`npm run dev`).

---

## Short codes de equipos

Se usa una tabla de override manual para países donde `nombre.substring(0,3).toUpperCase()` daría un resultado incorrecto o confuso (ej. "South Africa" → "SOU" en lugar de "RSA").

```typescript
const TEAM_SHORT_CODES: Record<string, string> = {
  'Japan': 'JPN',
  'South Korea': 'KOR',
  'Netherlands': 'NED',
  // ...
}
```
