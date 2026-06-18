import { buildFacts, fallbackText, type MatchUpdate } from './facts'
import { narrate } from './gemini'
import { postToDiscord } from './discord'
import type { LeaderboardRow } from './leaderboard-snapshot'

export type { MatchUpdate } from './facts'
export { snapshotLeaderboard, type LeaderboardRow } from './leaderboard-snapshot'

// Whether anyone is listening. Lets the sync skip the (cheap) before/after
// leaderboard snapshots entirely when no webhook is configured.
export function discordNotificationsEnabled(): boolean {
  return !!process.env.DISCORD_WEBHOOK_URL
}

// Build the facts from a sync, narrate them (LLM with template fallback) and
// post to Discord. Best-effort: any failure is logged, never thrown — a broken
// notification must never affect the sync or point-awarding.
export async function notifyMatchResults(params: {
  matches: MatchUpdate[]
  before: LeaderboardRow[]
  after: LeaderboardRow[]
}): Promise<void> {
  try {
    if (!discordNotificationsEnabled()) return
    if (params.matches.length === 0) return

    const facts = buildFacts(params.matches, params.before, params.after)
    const content = (await narrate(facts)) ?? fallbackText(facts)
    await postToDiscord(content)
  } catch (error) {
    console.error('notifyMatchResults failed (non-fatal):', error)
  }
}
