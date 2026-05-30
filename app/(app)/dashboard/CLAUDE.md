# Dashboard / Leaderboard — `/app/(app)/dashboard/`

## Qué hace esta pantalla

Muestra el ranking general de todos los participantes en tiempo real, con desglose de puntos por fase de grupos, playoffs y Bota de Oro. También muestra las estadísticas del usuario activo (su posición, puntos totales, etc.).

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Server Component | Fetcha el leaderboard y los puntos propios del usuario |
| `leaderboard-client.tsx` | Client Component (`"use client"`) | Tabla de ranking + suscripción Realtime de Supabase |

---

## Flujo de datos

```
page.tsx (servidor)
  ├── supabase.from('leaderboard').select('*')   → vista con ranking y desempate ya calculado
  └── supabase.from('scores').select('*').eq('user_id', user.id)  → desglose de puntos propios

  → Props: initialLeaderboard, currentUserId, userScore
```

La vista `leaderboard` es una vista de Postgres que aplica el desempate automáticamente:
1. Más puntos en rondas finales (semis + cuartos + final)
2. Acierto en Bota de Oro
3. Posición aleatoria (sorteo manual)

---

## Realtime — actualización automática

El leaderboard se actualiza solo cuando cualquier usuario gana puntos, sin necesidad de recargar la página.

```typescript
useEffect(() => {
  const channel = supabase
    .channel('scores-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
      router.refresh()  // re-ejecuta el Server Component y actualiza datos
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [supabase, router])
```

`router.refresh()` de Next.js 15 re-fetcha los datos del Server Component sin perder el estado del cliente (scroll, etc.).

---

## Tarjetas de estadísticas (stat cards)

Se generan dinámicamente desde un array:
- **Tu posición**: `#N` en el ranking
- **Puntos totales**: de 371 posibles
- **Fase de grupos**: `points_group` + `correct_group` aciertos
- **Playoffs**: `total_points_playoffs`

Los datos vienen de la tabla `scores`. Los campos `total_points*` son columnas `GENERATED ALWAYS AS` en Postgres (se recalculan automáticamente, nunca se insertan manualmente).

---

## Tabla de ranking

Columnas: Pos, Jugador (con avatar), Grupos, Playoffs, Bota, Total.

- El usuario actual aparece **resaltado en azul** (`bg-blue-500/5`)
- Posiciones 1, 2 y 3 muestran medallas (🥇🥈🥉) en vez de número
- El avatar usa DiceBear como fallback si no hay foto de perfil: `https://api.dicebear.com/7.x/thumbs/svg?seed={nombre}`
- Las columnas de detalle (Grupos, Playoffs, Bota) están ocultas en móvil (`hidden sm:table-cell`)

---

## Tipo de la vista leaderboard

```typescript
type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
// Campos relevantes:
// position, user_id, display_name, avatar_url,
// total_points, total_points_groups, total_points_playoffs, points_golden_boot
```

---

## Badge "En directo"

La página tiene un badge animado en el header:
```tsx
<span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
En directo
```

Esto es meramente visual — el verdadero "en directo" es la suscripción Realtime de Supabase.
