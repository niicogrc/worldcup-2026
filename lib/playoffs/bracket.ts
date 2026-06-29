// Estructura OFICIAL del cuadro de eliminatorias del Mundial 2026.
//
// Cada partido de R16 en adelante se alimenta de los ganadores de dos partidos
// anteriores (por número de partido, no por índice). Esta es la fuente de
// verdad del cuadro: openfootball la codifica como "W74", "W77", etc.
//
//   89: W74 vs W77      97: W89 vs W90      101: W97 vs W98
//   90: W73 vs W75      98: W93 vs W94      102: W99 vs W100
//   91: W76 vs W78      99: W91 vs W92      104 (final): W101 vs W102
//   92: W79 vs W80     100: W95 vs W96      103 (3er puesto): L101 vs L102
//   93: W83 vs W84
//   94: W81 vs W82
//   95: W86 vs W88
//   96: W85 vs W87
//
// ⚠️ El antiguo bracket usaba `Math.floor(i/2)` (emparejaba 73-74, 75-76…),
// que NO es el cuadro real. Esta tabla lo corrige.

export type BracketSource = { home: number; away: number }

/** matchNumber del cruce → matchNumbers de los partidos cuyos GANADORES lo disputan. */
export const BRACKET_SOURCES: Record<number, BracketSource> = {
  // Octavos (Round of 16)
  89: { home: 74, away: 77 },
  90: { home: 73, away: 75 },
  91: { home: 76, away: 78 },
  92: { home: 79, away: 80 },
  93: { home: 83, away: 84 },
  94: { home: 81, away: 82 },
  95: { home: 86, away: 88 },
  96: { home: 85, away: 87 },
  // Cuartos (Quarter-finals)
  97: { home: 89, away: 90 },
  98: { home: 93, away: 94 },
  99: { home: 91, away: 92 },
  100: { home: 95, away: 96 },
  // Semifinales
  101: { home: 97, away: 98 },
  102: { home: 99, away: 100 },
  // Final
  104: { home: 101, away: 102 },
}

/** El partido por el 3er puesto lo disputan los PERDEDORES de las semifinales. */
export const THIRD_PLACE_SOURCES: BracketSource = { home: 101, away: 102 }

/** Primer partido de R32 (donde arranca la cascada con equipos reales). */
export const FIRST_KNOCKOUT_MATCH = 73

/** match_number → match_number del cruce siguiente (para dibujar conectores). */
export const NEXT_MATCH: Record<number, number> = (() => {
  const map: Record<number, number> = {}
  for (const [target, src] of Object.entries(BRACKET_SOURCES)) {
    map[src.home] = Number(target)
    map[src.away] = Number(target)
  }
  return map
})()
