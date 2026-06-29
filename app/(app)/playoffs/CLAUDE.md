# Playoffs — `/app/(app)/playoffs/`

## Qué hace esta pantalla

Muestra el bracket de eliminatorias del Mundial (32avos → octavos → cuartos → semis → final) y permite al usuario predecir **todo el cuadro en cascada**: en cada cruce eliges qué equipo pasa y ese ganador rellena automáticamente la siguiente ronda, así se puede predecir el cuadro entero de una sentada aunque los equipos de rondas posteriores aún sean TBD. Incluye también el partido por el tercer puesto.

> En eliminatorias **solo se elige quién pasa**: la predicción es ese lado (`'1'` local / `'2'` visitante), no hay opción de empate (`'X'`). El acierto se puntúa contra el resultado a 90' (si el partido acaba en empate a 90' la predicción falla).

---

## Cascada del cuadro (cómo se rellenan las rondas)

- **R32 (partidos 73–88):** equipos reales (los grupos ya terminaron). Aquí arranca la cascada.
- **R16 → Final (89–104):** TBD en la DB. Se rellenan con el **ganador predicho** del cruce anterior.

La estructura oficial del cuadro vive en **`lib/playoffs/bracket.ts`** (`BRACKET_SOURCES`, `THIRD_PLACE_SOURCES`, `NEXT_MATCH`). Es por **número de partido**, no por índice: p.ej. R16 #89 = ganador(74) vs ganador(77).

> ⚠️ El bracket antiguo emparejaba con `Math.floor(i/2)` (73-74, 75-76…), que **no** es el cuadro real. `bracket.ts` lo corrige y el árbol que se pasa a `@g-loot/react-tournament-brackets` usa `nextMatchId` derivado de esa tabla.

`buildResolver()` en `playoffs-client.tsx` resuelve cada hueco: equipo real si ya se conoce, si no el ganador predicho del cruce fuente (recursivo, memoizado). Si un cruce fuente ya terminó usa el avance **real** (resultado a 90'; si X, penaltis `home_goals_pen`/`away_goals_pen`).

---

## Quién avanza (`predictions.advance_side`)

El modal solo pide elegir **qué equipo pasa**, y esa misma elección es la predicción:

| Pick del usuario | `advance_side` (cascada) | `prediction` (puntúa) |
|---|---|---|
| Pasa local | `'1'` | `'1'` |
| Pasa visitante | `'2'` | `'2'` |

`advance_side` (columna de la migración `20260109`) y `prediction` coinciden siempre en eliminatorias; se mantiene la columna porque el resolutor de la cascada la usa explícitamente (y como fallback deriva de `prediction`). En grupos es NULL. No afecta a los puntos.

---

## Archivos

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `page.tsx` | Server Component | Fetcha partidos de eliminatorias y predicciones del usuario |
| `playoffs-client.tsx` | Client Component (`"use client"`) | Bracket interactivo, modal de predicción, gestión de estado |

---

## Dependencias externas

```bash
npm install @g-loot/react-tournament-brackets styled-components react-svg-pan-zoom --legacy-peer-deps
```

> **Importante:** `styled-components` y `react-svg-pan-zoom` son dependencias implícitas de `@g-loot/react-tournament-brackets` que no se declaran en su package.json. Hay que instalarlas manualmente con `--legacy-peer-deps`.

---

## Flujo de datos

```
page.tsx (servidor)
  ├── supabase.from('matches').neq('phase','group')   → todos los partidos que NO son de grupos
  └── supabase.from('predictions')...                 → predicciones del usuario

  → Props a PlayoffsClient: initialMatches, initialPredictions
```

---

## Cómo se construye el bracket

La librería `@g-loot/react-tournament-brackets` espera un array de objetos `matches` con `nextMatchId`. En `playoffs-client.tsx` se mapea cada partido de eliminatorias (menos el 3er puesto) a un nodo:

```typescript
{
  id: '89',                       // = match_number como string
  nextMatchId: '97',             // = NEXT_MATCH[89] (de bracket.ts)
  tournamentRoundText: 'Octavos',
  state: 'DONE' | 'LIVE' | 'SCHEDULED',
  dbMatch: match,                 // referencia original
  resolvedHome, resolvedAway,     // equipos resueltos por la cascada
  participants: [{ id, name, resultText, isWinner }, { ... }],
}
```

`nextMatchId` sale de `NEXT_MATCH` en `lib/playoffs/bracket.ts` (estructura oficial), **no** de `floor(i/2)`. Los `participants` se rellenan con `resolver.slot(num, 'home'|'away')` (cascada).

---

## Modal de predicción

Hacer click en un nodo abre un **modal** (Framer Motion). `openMatch(dbMatch)` precarga la pick actual (`modalSide` = lado que avanza). El usuario elige **qué equipo pasa** (botones `TeamPickButton`) y pulsa **Guardar**:

```typescript
handlePredictSubmit()
  prediction  = modalSide                          // lo que puntúa (= quién pasa)
  advanceSide = modalSide                           // lo que mueve la cascada
  → POST /api/predictions { matchId, prediction, advanceSide, porraId }
  → setPredictions / setAdvanceSides → la siguiente ronda se recalcula sola
```

Si los equipos del cruce aún no están resueltos (faltan picks anteriores), el modal pide completar primero los cruces previos.

---

## CustomMatchNode

El bracket renderiza cada partido con un componente custom (`CustomMatchNode`) que muestra:
- Número de partido y fecha
- Bandera + nombre de cada equipo
- Resultado si el partido terminó
- Indicador de la predicción del usuario (resaltado en azul)

---

## Partido por el 3er puesto

`third_place` se trata por separado: no entra en el árbol del bracket (se filtra con `.filter(m => m.phase !== 'third_place')`). Se renderiza en un card independiente debajo del bracket.

---

## Ver predicciones de otros miembros

Igual que en grupos: selector `MemberViewBar` + hook `useMemberView` (un fetch a `GET /api/porras/{porraId}/predictions?userId=` por miembro, cacheado). Al ver a otro miembro:

- El bracket y el card del tercer puesto pintan `shownPredictions` (las del miembro visto en vez de las propias).
- El modal pasa a solo lectura: muestra la predicción del miembro si el partido ya empezó, "oculta hasta el kick-off" si no, o "no hizo predicción".
- La RLS garantiza que las predicciones de partidos sin empezar nunca llegan al cliente.

---

## Regla importante: ¿Qué vale empate en eliminatorias?

En eliminatorias, si hay empate a 90 minutos el resultado es **X**, aunque luego haya prórroga o penaltis. El ganador de la eliminatoria en la realidad NO afecta a la predicción de la porra. Solo cuentan los 90 minutos.

Esto se refleja en que `result_ft` siempre se calcula a partir de `home_goals_ft` / `away_goals_ft` (goles a 90'), no del marcador final.

---

## Puntuación por ronda

| Ronda | Puntos por acierto |
|---|---|
| Dieciseisavos (×16) | 3 pts |
| Octavos (×8) | 4 pts |
| Cuartos (×4) | 6 pts |
| Semis (×2) | 8 pts |
| 3er puesto (×1) | 5 pts |
| Final (×1) | 15 pts |
