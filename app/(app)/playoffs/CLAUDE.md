# Playoffs — `/app/(app)/playoffs/`

## Qué hace esta pantalla

Permite predecir **todo el cuadro de eliminatorias en cascada**: en cada cruce tocas el equipo que crees que pasa y ese ganador rellena automáticamente la siguiente ronda, así se puede predecir el cuadro entero de una sentada aunque los equipos de rondas posteriores aún sean TBD.

La interfaz principal es **una ronda a la vez** (tabs: Dieciseisavos → Octavos → Cuartos → Semis → Final → 3.º), como **lista de cards** a ancho completo donde tocas el equipo que pasa (sin modal). El **cuadro-árbol** (`@g-loot/react-tournament-brackets`) queda como **vista general de solo lectura colapsable**. Patrón validado por research de UX (ESPN/pick'em, mobile-first): el árbol completo es buen *overview* pero mal medio de *input*.

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

Tocar un equipo en su card lo marca como **quién pasa**, y esa misma elección es la predicción:

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
| `playoffs-client.tsx` | Client Component (`"use client"`) | Tabs por ronda + lista de cards (input), cascada, overview colapsable, estado |

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

## Interfaz: tabs por ronda + lista de cards

- **Tabs** (`ROUNDS`): una ronda activa (`activeRound`), sticky arriba, con contador `done/total` por ronda. Incluye el 3.er puesto como una ronda más.
- **Lista**: los partidos de la ronda activa se pintan como `MatchCard` (componente a nivel de módulo). Cada equipo es una fila; tocarla marca quién pasa:

```typescript
pickAdvancer(match, side)               // side = '1' | '2'
  // optimista: actualiza predictions/advanceSides ya (la cascada se recalcula)
  → POST /api/predictions { matchId, prediction: side, advanceSide: side, porraId }
  // si falla, revierte al valor anterior
```

- **Progreso**: barra + `predichos/total` de la ronda activa.
- **Siguiente ronda**: botón al final que salta a la ronda siguiente (scroll arriba).
- Estado por card: `interactive` (editable), `finished`/`live`, `note` ("Completa la ronda anterior", "Cerrado", o el motivo de solo-lectura al ver a otro miembro). Si el cruce aún no tiene los dos equipos resueltos no es editable.

---

## Overview: cuadro completo (solo lectura)

Colapsable ("Ver cuadro completo"). Reusa `@g-loot/react-tournament-brackets` con `mappedMatches`:

```typescript
{ id: '89', nextMatchId: '97' /* = NEXT_MATCH[89] */, participants: [...], dbMatch }
```

`nextMatchId` sale de `NEXT_MATCH` en `lib/playoffs/bracket.ts` (estructura oficial), **no** de `floor(i/2)`. Los `participants` se resuelven con `resolver.slot(num, 'home'|'away')`. El nodo (`OverviewNode`) es de solo lectura; al tocarlo **salta a la ronda** de ese partido (`jumpToRound`) para editarlo en la lista.

El 3.er puesto no entra en el árbol del overview (se filtra), pero sí aparece como su propia ronda en los tabs.

---

## Ver predicciones de otros miembros

Igual que en grupos: selector `MemberViewBar` + hook `useMemberView` (un fetch a `GET /api/porras/{porraId}/predictions?userId=` por miembro, cacheado). Al ver a otro miembro:

- Las cards y el overview pintan `shownPredictions` / `shownAdvanceSides` (los del miembro visto en vez de los propios).
- Las cards pasan a solo lectura (`interactive = false`): muestran la pick del miembro si el partido ya empezó, "oculta hasta el kick-off" si no, o "no hizo predicción".
- La RLS garantiza que las predicciones de partidos sin empezar nunca llegan al cliente (el hook expone además `viewedAdvanceSides`).

---

## Regla importante: empates en eliminatorias

El `result_ft` del partido se calcula siempre a 90' (`home_goals_ft` / `away_goals_ft`), no del marcador final tras prórroga/penaltis. Como el usuario **solo elige quién pasa** (`'1'`/`'2'`, sin `'X'`), una predicción acierta sólo si `prediction === result_ft`: si el partido acaba **empatado a 90'** (`result_ft = 'X'`) la predicción **falla**, aunque ese equipo pasara en penaltis. La cascada sí usa el avance real (penaltis) para rellenar la siguiente ronda; los puntos no.

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
