# Fase de Grupos — `/app/(app)/grupos/`

## Qué hace esta pantalla

Permite a cada usuario predecir el resultado (1, X o 2) de los 72 partidos de la fase de grupos del Mundial 2026, organizados en 12 grupos (A–L). También muestra la clasificación actualizada de cada grupo.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Server Component | Fetcha datos de Supabase y pasa props al cliente |
| `groups-client.tsx` | Client Component (`"use client"`) | Toda la interactividad: tabs de grupo, botones 1/X/2, guardado optimista |

---

## Flujo de datos

```
page.tsx (servidor)
  ├── supabase.from('matches').select(...).eq('phase','group')   → 72 partidos con equipos locales/visitantes
  ├── supabase.from('predictions').select('*').eq('user_id',...)  → predicciones ya guardadas del usuario
  └── supabase.from('group_standings').select(...)               → tabla de clasificación por grupo

  → Props a GroupsClient:
      initialMatches, initialPredictions, standings
```

El **Server Component** usa `export const dynamic = 'force-dynamic'` para que Next.js no cachee la página (los partidos y predicciones cambian frecuentemente).

---

## Banner de importación de predicciones

Si el usuario **no tiene ninguna predicción** en la porra activa pero sí en otra porra suya, `page.tsx` pasa `importablePorras` (otras porras donde tiene predicciones) y el cliente muestra un banner con dos opciones:

- **Importar de {porra}** — llama a `POST /api/porras/{porraId}/import-predictions` con `{ sourcePorraId }`. La respuesta incluye las predicciones insertadas (`predictions[]`), que se mergean en el estado local para reflejarse sin recargar; además se hace `router.refresh()`.
- **Hacerlas de cero** — oculta el banner (estado local, reaparece al recargar si sigue sin predicciones).

Tras importar se muestra un mensaje verde con el número de predicciones copiadas.

---

## Ver predicciones de otros miembros

Encima de los tabs de grupo hay un selector de miembros de la porra activa ("Viendo predicciones de: Tú / …"). Implementado con el hook compartido `useMemberView` (`lib/hooks/use-member-view.ts`) y el componente `MemberViewBar` (`components/porra/member-view-bar.tsx`), reutilizados también en playoffs. Al seleccionar a otro miembro:

- Se hace `GET /api/porras/{porraId}/predictions?userId={userId}` y se cachea la respuesta en el hook, un fetch por miembro.
- La vista pasa a **solo lectura**: los botones 1/X/2 se deshabilitan y muestran la elección del otro usuario.
- Solo se ven sus predicciones de partidos ya empezados — la RLS (`"Usuarios ven predicciones de otros SOLO tras kick-off"`) filtra el resto en la DB. Los partidos sin empezar muestran "Predicción oculta hasta el kick-off".
- El banner de importación se oculta mientras se ve a otro miembro.

`page.tsx` fetcha los miembros (`porra_members` join `profiles`) y pasa `members` + `currentUserId` al cliente.

**Deep-link `?member=<userId>`:** `page.tsx` lee el query param `member` y lo pasa como `initialViewUserId` a `GroupsClient`. El hook `useMemberView` lo preselecciona al montar (un `useEffect` que llama a `viewMember`). Lo usan las filas del leaderboard para abrir directamente las predicciones de un usuario con sus puntos.

---

## Cómo funciona la predicción (lógica optimista)

1. El usuario hace click en "1", "X" o "2"
2. El estado local se actualiza **inmediatamente** (UI optimista, sin esperar al servidor)
3. Se llama `POST /api/predictions` con `{ matchId, prediction }`
4. Si el servidor devuelve error → se revierte al estado anterior y se muestra el mensaje de error
5. Si hay éxito → la UI ya estaba actualizada, no hace falta nada más

```typescript
const handlePredict = async (matchId: string, choice: MatchResult) => {
  const prev = predictions[matchId]
  setPredictions(p => ({ ...p, [matchId]: choice }))  // optimista
  // ... llama a /api/predictions
  // si falla: setPredictions(p => ({ ...p, [matchId]: prev }))  // revierte
}
```

---

## Lógica de bloqueo

Un partido está **bloqueado** (no se puede predecir) cuando `kickoff_at <= new Date()`. El cálculo se hace en el cliente:

```typescript
const isLocked = new Date(match.kickoff_at) <= new Date()
```

El botón se deshabilita con `disabled={isLocked}`. El servidor también valida esto en `/api/predictions/route.ts`, así que aunque se manipule el DOM, no se puede hacer trampa.

---

## Estados visuales de un partido

| Estado | Cómo se detecta | Qué muestra |
|---|---|---|
| Próximo | `status = 'NS'` | Fecha y hora del partido |
| En directo | `status` en `['1H','HT','2H','ET','P']` | Badge "En juego" con pulso animado |
| Finalizado | `status` en `['FT','AET','PEN']` | Resultado final + indicador ✓/✗ |

---

## Tabla de clasificación

Se muestra a la derecha (layout de 3 columnas en desktop, apilado en móvil). Los datos vienen de `group_standings`, que Supabase actualiza al hacer sync con API-Football.

Columnas: Pos, Equipo, PJ (partidos jugados), DG (diferencia de goles), Pts.

---

## Banderas

Las banderas se obtienen de `lib/flags.ts` con `getFlagUrl(teamName)`. Si el equipo no está en el mapa, muestra el código corto del equipo (ej. `ESP`). La URL tiene el formato `https://flagcdn.com/w40/{code}.png`.

---

## Tipos relevantes

```typescript
// Un partido con sus equipos (join de Supabase)
type MatchWithTeams = Database['public']['Tables']['matches']['Row'] & {
  home_team: { id, name, flag_url, group_letter, short_code } | null
  away_team: { id, name, flag_url, group_letter, short_code } | null
}

// Una predicción del usuario
type PredictionRow = Database['public']['Tables']['predictions']['Row']

// Una fila de clasificación con el equipo unido
type StandingWithTeam = Database['public']['Tables']['group_standings']['Row'] & {
  team: { id, name, flag_url, short_code } | null
}
```

---

## Puntuación de grupos

- Acertar: **+3 puntos**
- Fallar: **+0 puntos**
- Máximo de grupos: 72 partidos × 3 = **216 puntos**

El campo `is_correct` de la predicción se actualiza automáticamente en la DB mediante el trigger `on_match_result_award_points` cuando el árbitro marca el partido como FT.
