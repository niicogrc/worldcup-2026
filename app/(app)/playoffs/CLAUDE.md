# Playoffs — `/app/(app)/playoffs/`

## Qué hace esta pantalla

Muestra el bracket de eliminatorias del Mundial (32avos → octavos → cuartos → semis → final) y permite al usuario predecir el resultado (1-X-2) de cada partido. Incluye también el partido por el tercer puesto.

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

La librería `@g-loot/react-tournament-brackets` espera un array de objetos `matches` con una estructura específica. En `playoffs-client.tsx`, la función `addPhaseMatches()` convierte los datos de la DB a ese formato:

```typescript
// Cada partido en la DB → un nodo del bracket
{
  id: 'R32-0',           // identificador único en el árbol
  nextMatchId: 'R16-0',  // dónde va el ganador
  tournamentRoundText: 'Dieciseisavos',
  state: 'DONE' | 'LIVE' | 'SCHEDULED',
  dbMatch: match,        // referencia original para UI custom
  participants: [
    { id, name, resultText, isWinner },
    { id, name, resultText, isWinner },
  ]
}
```

El árbol de nextMatchId conecta los partidos entre rondas. El índice determina el emparejamiento: el partido `i` alimenta al partido `Math.floor(i / 2)` de la siguiente ronda.

---

## Modal de predicción

Como el bracket es compacto, hacer click en cualquier partido abre un **modal** (Framer Motion) para seleccionar 1/X/2. El estado `activePredictMatch` controla qué modal está abierto.

```typescript
// Abrir modal al hacer click en un nodo
setActivePredictMatch(dbMatch)

// Cerrar y guardar
handlePredictSubmit(choice: MatchResult)
  → POST /api/predictions
  → setPredictions(prev => ({ ...prev, [matchId]: choice }))
  → setActivePredictMatch(null)
```

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
