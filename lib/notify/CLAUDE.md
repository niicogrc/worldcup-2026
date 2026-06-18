# Notificaciones — `/lib/notify/`

## Qué hace

Manda un mensaje a Discord **cada vez que el sync hace terminar algún partido** (`matchesUpdated > 0`). Si en una pasada del cron no acaba ningún partido, **no envía nada**.

El mensaje incluye los resultados a 90' y el impacto en el ranking de cada porra afectada (quién ha sumado puntos, quién lidera). El texto lo redacta un LLM (Gemini Flash, free tier); si no hay key o falla, cae a una plantilla fija.

Todo es **best-effort**: cualquier fallo (Discord caído, cuota de Gemini agotada, etc.) se loguea pero **nunca** rompe el sync ni el reparto de puntos.

---

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `index.ts` | Orquesta: `notifyMatchResults()` + `snapshotLeaderboard()` + `discordNotificationsEnabled()` |
| `facts.ts` | Tipos (`MatchUpdate`, `NotifyFacts`) + `buildFacts()` (diff before/after) + `fallbackText()` |
| `leaderboard-snapshot.ts` | `snapshotLeaderboard()` — lee la vista `leaderboard` de todas las porras |
| `gemini.ts` | `narrate()` — llama a la API de Gemini; devuelve `null` si no hay key o falla |
| `discord.ts` | `postToDiscord()` — POST al webhook |

---

## Flujo (enganchado en `lib/thesportsdb/sync.ts`)

```
1. Si DISCORD_WEBHOOK_URL no está → no se hace nada (ni snapshots).
2. snapshot ANTES de aplicar resultados (estado del leaderboard).
3. Aplicar fixtures (el trigger de DB reparte puntos en el momento).
4. Si totals.updates.length > 0:
   - snapshot DESPUÉS (ya refleja los puntos nuevos).
   - buildFacts(updates, before, after) → solo porras con cambios.
   - narrate(facts) con Gemini; si null → fallbackText(facts).
   - postToDiscord(content).
```

Solo se incluyen en `updates` los partidos que pasan a **FT** (los AET/PEN se saltan, igual que en el sync: requieren entrada manual del 90').

---

## Variables de entorno

```env
DISCORD_WEBHOOK_URL=   # webhook del canal. SIN ESTA VARIABLE, el módulo no hace nada.
GEMINI_API_KEY=        # opcional. Sin ella → plantilla fija (sin LLM).
GEMINI_MODEL=gemini-2.0-flash   # opcional, default
```

⚠️ El webhook es una credencial y el repo es público: va solo en `.env.local` / Vercel, nunca commiteado.

---

## Cómo probarlo

Con las env vars puestas y `npm run dev`, dispara un sync manual:

```bash
curl -X POST http://localhost:3000/api/sync-matches \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

Si ese rango de fechas tiene algún partido que pasa a FT, llega el mensaje a Discord. Para forzar un mensaje fuera del torneo, lo más simple es probar `buildFacts`/`postToDiscord` con datos de ejemplo.
