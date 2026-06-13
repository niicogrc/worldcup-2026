# API — Sync Matches — `/app/api/sync-matches/`

## Qué hace este endpoint

Sincroniza los resultados de los partidos del día desde TheSportsDB hacia la base de datos. Se ejecuta automáticamente cada hora mediante un cron job de Vercel.

---

## Endpoint

```
POST /api/sync-matches
Header: Authorization: Bearer <CRON_SECRET>
```

Solo acepta POST. Valida el header de autorización antes de hacer cualquier cosa.

---

## Cron job de Vercel

Configurado en `vercel.json`:
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

Se ejecuta a los 5 minutos de cada hora (ej. 12:05, 13:05, 14:05...). Vercel añade automáticamente el header `Authorization: Bearer <CRON_SECRET>` en ejecuciones programadas.

---

## Flujo de la sincronización

El endpoint delega toda la lógica a `lib/thesportsdb/sync.ts`:

```typescript
const result = await syncTodayMatches()
```

Ver `lib/thesportsdb/CLAUDE.md` para el detalle completo del proceso de sync.

---

## Respuestas

| Código | Cuándo |
|---|---|
| 200 `{ message: 'Sync completed successfully', details }` | Sync exitoso |
| 401 `{ error: 'Unauthorized' }` | Header de autorización incorrecto o ausente |
| 500 `{ message: 'Sync completed with errors', details }` | Sync con errores parciales |
| 500 `{ error: 'CRON_SECRET is not configured' }` | Variable de entorno faltante |

---

## Presupuesto de API

TheSportsDB devuelve todos los fixtures del torneo en una sola llamada (no hay filtro por fecha en la API). El filtrado se hace en `sync.ts` en memoria.

```
Sync de hoy: 1 request (GET /eventsseason.php?id=4429&s=2026)
× 24 ejecuciones/día = 24 requests/día
```

---

## Cómo testear manualmente

```bash
curl -X POST http://localhost:3000/api/sync-matches \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Responderá con `{ matchesChecked, matchesUpdated, apiCallsUsed, durationMs }`.
