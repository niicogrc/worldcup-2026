# TheSportsDB — `/lib/thesportsdb/`

## Por qué existe

API-Football free tier no tiene acceso a datos de la temporada 2026. TheSportsDB sí los tiene de forma gratuita y es la fuente actual de resultados del torneo.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `client.ts` | Cliente HTTP + normalización de fixtures del Mundial 2026 |
| `sync.ts` | Lógica de sincronización: consume `client.ts`, actualiza `matches` en DB, registra en `sync_logs` |

---

## `client.ts`

### Endpoint que consume

```
GET https://www.thesportsdb.com/api/v1/json/{key}/eventsseason.php?id=4429&s=2026
```

- `id=4429` → liga FIFA World Cup en TheSportsDB
- `s=2026` → temporada 2026
- Una sola llamada devuelve **todos** los partidos del torneo (104 fixtures)

### Tipo exportado principal

```typescript
export interface WorldCupFixture {
  sourceId: string          // idEvent de TheSportsDB
  homeTeam: string
  awayTeam: string
  homeScore: number | null  // null si el partido no ha terminado
  awayScore: number | null
  status: MatchStatus       // mapeado desde strStatus de la API
  kickoffIso: string        // ISO UTC, ej. "2026-06-11T19:00:00.000Z"
  round: string | null      // número de jornada/ronda
  finished: boolean         // true cuando status es 'FT' | 'AET' | 'PEN'
}
```

### Función principal

```typescript
export async function getWorldCupFixtures(): Promise<WorldCupFixture[]>
```

### Regla crítica: FT vs AET/PEN

- **`status === 'FT'`**: partido decidido en 90'. Los scores son el resultado a 90'. Se escribe directamente en la DB.
- **`status === 'AET'` o `'PEN'`**: partido que fue a prórroga/penaltis. TheSportsDB devuelve el marcador **post-prórroga**, NO el marcador a 90'. Como nuestra regla de negocio solo cuenta el resultado a 90' (y si fue a AET/PEN implica que estaba empatado al 90'), **estos casos NO se sincronizan automáticamente**. El admin debe introducir manualmente el marcador real a 90' desde el panel de administración (pestaña "Partidos").

---

## Variable de entorno

```env
THESPORTSDB_KEY=3   # '3' es la key de test pública; suficiente para el torneo
```

Se puede registrar una cuenta gratuita en https://www.thesportsdb.com/ para obtener una key con mayor cuota.

---

## Mapeo de estados

`mapStatus()` convierte el `strStatus` de la API a nuestro enum `MatchStatus`:

| TheSportsDB `strStatus` | Nuestro `MatchStatus` |
|---|---|
| `'Match Finished'` | `'FT'` |
| `'Not Started'` | `'NS'` |
| `'FT'`, `'AET'`, `'PEN'`, etc. | pass-through directo |
| `null` | `'NS'` |
| `strPostponed === 'yes'` | `'PST'` |
