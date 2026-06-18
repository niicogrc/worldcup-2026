import type { LeaderboardRow } from './leaderboard-snapshot'

// A match that just transitioned to FT during a sync.
export interface MatchUpdate {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  result: '1' | 'X' | '2'
  phase: string
}

// The structured "facts" handed to the LLM (and to the fallback template).
// `mention` is the token used to refer to a person in the message: a Discord
// mention (`<@id>`) when the user has a Discord ID, otherwise their plain name.
export interface NotifyFacts {
  matches: Array<{ label: string; phase: string; result: string }>
  porras: Array<{
    name: string
    leader: { mention: string; points: number } | null
    movers: Array<{ mention: string; gained: number; fromPos: number; toPos: number }>
  }>
}

function mentionOf(row: { discordUserId: string | null; displayName: string }): string {
  return row.discordUserId ? `<@${row.discordUserId}>` : row.displayName
}

const PHASE_LABELS: Record<string, string> = {
  group: 'Fase de grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinal',
  third_place: '3er puesto',
  final: 'Final',
}

const RESULT_LABELS: Record<string, string> = {
  '1': 'victoria local',
  X: 'empate',
  '2': 'victoria visitante',
}

// Build the facts object from the updated matches and the before/after
// leaderboard snapshots. Only porras whose ranking actually moved are included.
export function buildFacts(
  matches: MatchUpdate[],
  before: LeaderboardRow[],
  after: LeaderboardRow[],
): NotifyFacts {
  const matchFacts = matches.map((m) => ({
    label: `${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}`,
    phase: PHASE_LABELS[m.phase] ?? m.phase,
    result: RESULT_LABELS[m.result] ?? m.result,
  }))

  const key = (porraId: string, userId: string) => `${porraId}:${userId}`
  const beforePts = new Map<string, number>()
  const beforePos = new Map<string, number>()
  for (const r of before) {
    beforePts.set(key(r.porraId, r.userId), r.totalPoints)
    beforePos.set(key(r.porraId, r.userId), r.position)
  }

  const byPorra = new Map<string, { name: string; rows: LeaderboardRow[] }>()
  for (const r of after) {
    if (!byPorra.has(r.porraId)) byPorra.set(r.porraId, { name: r.porraName, rows: [] })
    byPorra.get(r.porraId)!.rows.push(r)
  }

  const porras: NotifyFacts['porras'] = []
  for (const [porraId, { name, rows }] of byPorra) {
    rows.sort((a, b) => a.position - b.position)
    const leader = rows[0] ? { mention: mentionOf(rows[0]), points: rows[0].totalPoints } : null

    const movers = rows
      .map((r) => {
        const k = key(porraId, r.userId)
        const prevPts = beforePts.get(k) ?? r.totalPoints
        return {
          mention: mentionOf(r),
          gained: r.totalPoints - prevPts,
          fromPos: beforePos.get(k) ?? r.position,
          toPos: r.position,
        }
      })
      .filter((m) => m.gained > 0)
      .sort((a, b) => b.gained - a.gained)

    // Only report porras that were actually affected by these matches.
    if (movers.length > 0) porras.push({ name, leader, movers })
  }

  return { matches: matchFacts, porras }
}

// Deterministic message used when the LLM is unavailable (no key, quota, error).
export function fallbackText(facts: NotifyFacts): string {
  const lines: string[] = ['⚽ **Resultados actualizados**', '']

  for (const m of facts.matches) {
    lines.push(`• ${m.label} — ${m.phase}`)
  }

  for (const p of facts.porras) {
    lines.push('', `🏆 **${p.name}**`)
    if (p.leader) lines.push(`Lidera ${p.leader.mention} con ${p.leader.points} pts`)
    for (const mv of p.movers) {
      const climbed = mv.toPos < mv.fromPos ? ` ⬆️ ${mv.fromPos}º→${mv.toPos}º` : ''
      lines.push(`+${mv.gained} pts · ${mv.mention}${climbed}`)
    }
  }

  return lines.join('\n')
}
