# API-Football — `/lib/api-football/`

## Qué hace esta carpeta

Módulo que encapsula toda la comunicación con la API de API-Football (api-sports.io). Tiene dos partes: el cliente HTTP y la lógica de sincronización.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `client.ts` | Cliente HTTP tipado para API-Football |
| `sync.ts` | Lógica de sincronización: fetcha resultados y actualiza la DB |

---

## `client.ts` — Cliente HTTP

### Función base: `apiFetch`

```typescript
async function apiFetch<T>(endpoint: string, options: FetchOptions): Promise<T>
```

- Construye la URL: `https://v3.football.api-sports.io{endpoint}?{params}`
- Añade el header `x-apisports-key: API_FOOTBALL_KEY`
- Lanza error si la respuesta no es OK o si la API devuelve errores en el campo `data.errors`

### Endpoints exportados

```typescript
getFixtures(date?: string)   → ApiFootballFixture[]
// GET /fixtures?league=1&season=2026[&date=YYYY-MM-DD]

getStandings()               → standings array
// GET /standings?league=1&season=2026
```

### Tipos importantes

```typescript
ApiFootballFixture {
  fixture.id              // → matches.api_football_id
  fixture.date            // → matches.kickoff_at
  fixture.status.short    // → matches.status (NS, FT, AET, PEN...)
  goals.home / goals.away // → goles a 90'
  score.extratime.*       // → goles en prórroga
  score.penalty.*         // → goles en penaltis
  teams.home.id / .name   // → teams.api_football_id
}
```

---

## `sync.ts` — Sincronización de resultados

### Función principal: `syncTodayMatches()`

Devuelve un `SyncResult`:
```typescript
interface SyncResult {
  success: boolean
  matchesChecked: number   // partidos que devolvió API-Football hoy
  matchesUpdated: number   // partidos actualizados en la DB
  apiCallsUsed: number     // siempre 1 (una sola llamada)
  durationMs: number
  errorMessage?: string
}
```

### Flujo interno

```
1. Calcula la fecha de hoy en formato YYYY-MM-DD (UTC)
2. Llama a getFixtures(hoy) → array de fixtures del día
3. Para cada fixture:
   a. Solo procesa los que tienen status FT, AET o PEN (partidos terminados)
   b. Busca el partido en la DB por api_football_id
   c. Si ya tiene home_goals_ft grabado con el mismo status → salta (evita re-triggers)
   d. UPDATE matches SET home_goals_ft, away_goals_ft, home_goals_aet, ...
4. Al actualizar goals, el trigger set_match_result_ft calcula result_ft automáticamente
5. El trigger on_match_result_award_points distribuye puntos a las predicciones
6. Registra el resultado en sync_logs (incluso si hay errores)
```

### Por qué se usa `createAdminClient`

El sync necesita actualizar partidos (tabla `matches`) sin restricciones de RLS, ya que es un proceso del servidor, no de un usuario autenticado. El service role key bypasea todas las políticas RLS.

---

## Identificadores del Mundial 2026 en API-Football

```
league = 1
season = 2026
```

Estos valores van en todos los requests. Liga `1` es la FIFA World Cup.

---

## Variables de entorno requeridas

```env
API_FOOTBALL_KEY=<tu-api-key>   # nunca exponer al cliente
```

Obtenida en https://dashboard.api-football.com/. El free tier da 100 req/día.

---

## Gotcha: IDs sintéticos en el seed

El seed inicial usa IDs sintéticos (90001–90104) como `api_football_id`. El sync de API-Football busca partidos en la DB por este campo. Si los IDs reales de API-Football para 2026 no coinciden con estos sintéticos, el sync no encontrará los partidos y no actualizará nada.

**Solución cuando estén disponibles los IDs reales:** actualizar los `api_football_id` en la tabla `matches` con los IDs reales que devuelve la API.
