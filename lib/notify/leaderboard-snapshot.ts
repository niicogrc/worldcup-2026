import { createAdminClient } from '@/lib/supabase/server'

// One row of the `leaderboard` view, flattened with its porra name resolved.
export interface LeaderboardRow {
  porraId: string
  porraName: string
  userId: string
  displayName: string
  discordUserId: string | null
  totalPoints: number
  position: number
}

// Snapshot the full leaderboard (every porra) at a point in time. Used to diff
// before/after a sync and report who gained points / climbed the ranking.
export async function snapshotLeaderboard(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<LeaderboardRow[]> {
  const { data: porras } = await (supabase.from('porras') as any).select('id, name')
  const porraName = new Map<string, string>(
    (porras ?? []).map((p: any) => [p.id as string, p.name as string]),
  )

  // Discord IDs live on profiles, not on the leaderboard view; resolve them by user.
  const { data: profiles } = await (supabase.from('profiles') as any).select('id, discord_user_id')
  const discordId = new Map<string, string | null>(
    (profiles ?? []).map((p: any) => [p.id as string, (p.discord_user_id as string | null) ?? null]),
  )

  const { data, error } = await (supabase.from('leaderboard') as any).select(
    'porra_id, user_id, display_name, total_points, position',
  )
  if (error || !data) return []

  return (data as any[]).map((r) => ({
    porraId: r.porra_id,
    porraName: porraName.get(r.porra_id) ?? 'Porra',
    userId: r.user_id,
    displayName: r.display_name ?? 'Anónimo',
    discordUserId: discordId.get(r.user_id) ?? null,
    totalPoints: r.total_points ?? 0,
    position: r.position ?? 0,
  }))
}
