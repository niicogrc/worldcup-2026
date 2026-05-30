# Bota de Oro — `/app/(app)/bota-de-oro/`

## Qué hace esta pantalla

Permite al usuario elegir al jugador que cree que ganará la Bota de Oro (máximo goleador del Mundial 2026). La predicción se bloquea automáticamente antes del primer partido del torneo (11 jun 2026 ~18:55 UTC).

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Server Component | Fetcha la predicción existente, lista de equipos y kickoff del primer partido |
| `golden-boot-client.tsx` | Client Component (`"use client"`) | Buscador de jugadores, countdown, guardado |

---

## Flujo de datos

```
page.tsx (servidor)
  ├── supabase.from('golden_boot_predictions')...   → predicción actual del usuario (si existe)
  ├── supabase.from('teams').select('id, name, short_code, flag_url')  → lista de 48 equipos
  └── supabase.from('matches').order('kickoff_at').limit(1)            → fecha del primer partido

  → Props: initialPrediction, teams, firstMatchKickoff
```

---

## Búsqueda de jugadores

El listado de candidatos vive en `lib/players.ts` (array `WORLD_CUP_2026_PLAYERS`). Contiene los atacantes y goleadores principales de los 48 equipos participantes, con nombre y `teamName` que debe coincidir exactamente con el nombre en la tabla `teams`.

```typescript
filtered = WORLD_CUP_2026_PLAYERS
  .filter(p => p.name.toLowerCase().includes(query.toLowerCase())
            || p.teamName.toLowerCase().includes(query.toLowerCase()))
  .slice(0, 10)
```

Si el jugador no aparece en la lista, el usuario puede escribir el nombre manualmente y guardarlo igual.

---

## Bloqueo automático

La predicción se bloquea cuando `kickoff del primer partido <= ahora`. El cálculo lo hace el cliente:

```typescript
const isLocked = timeLeft.isPast  // true cuando el countdown llega a 0
```

Adicionalmente, el servidor (`/api/golden-boot/route.ts`) verifica lo mismo y devuelve 400 si el torneo ya empezó, evitando cualquier manipulación del cliente.

---

## Countdown

Un `useEffect` con `setInterval` de 1 segundo calcula el tiempo restante hasta `firstMatchKickoff`:

```typescript
const diff = +new Date(firstMatchKickoff) - Date.now()
setTimeLeft({
  days: Math.floor(diff / 86400000),
  hours: Math.floor((diff / 3600000) % 24),
  minutes: Math.floor((diff / 60000) % 60),
  seconds: Math.floor((diff / 1000) % 60),
  isPast: diff <= 0
})
```

Cuando `isPast = true`, el formulario muestra "Predicción bloqueada" y el botón se deshabilita.

---

## Guardado

```typescript
POST /api/golden-boot
Body: { playerName: string, teamId: string | null }
```

La API hace upsert: si ya existe una predicción, la actualiza; si no, la crea. El equipo se vincula automáticamente al seleccionar un jugador del dropdown (busca el equipo por nombre en la lista `teams`).

---

## Puntuación

- Acertar: **+15 puntos**
- En caso de empate en el marcador de goles, cualquiera de los máximos goleadores con el mismo número de goles cuenta como acierto

---

## Visibilidad

Las predicciones de Bota de Oro son privadas hasta el 11 jun 2026 19:00 UTC. Después, todos ven la predicción de todos (política de RLS en Supabase).
