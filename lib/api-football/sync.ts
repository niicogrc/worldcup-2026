import { createAdminClient } from '@/lib/supabase/server'
import { getFixtures, ApiFootballFixture } from './client'
import { MatchStatus } from '@/lib/supabase/types'

export interface SyncResult {
  success: boolean
  matchesChecked: number
  matchesUpdated: number
  apiCallsUsed: number
  durationMs: number
  errorMessage?: string
}

export async function syncTodayMatches(): Promise<SyncResult> {
  const startTime = Date.now()
  let matchesChecked = 0
  let matchesUpdated = 0
  const supabase = createAdminClient()

  try {
    // Get current date in YYYY-MM-DD format (UTC)
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Fetch from API-Football
    const fixtures: ApiFootballFixture[] = await getFixtures(todayStr)
    matchesChecked = fixtures.length

    for (const fixture of fixtures) {
      const apiId = fixture.fixture.id
      const statusShort = fixture.fixture.status.short as MatchStatus

      // We only sync matches that have completed in some way
      const isFinished = ['FT', 'AET', 'PEN'].includes(statusShort)
      if (!isFinished) continue

      // Look up match in DB — first by api_football_id, then fall back to kickoff_at
      let { data: match, error: fetchError } = await (supabase.from('matches') as any)
        .select('*')
        .eq('api_football_id', apiId)
        .maybeSingle()

      if (fetchError) continue

      if (!match) {
        // Fallback: seed used synthetic IDs — try to match by kickoff time
        const kickoffIso = new Date(fixture.fixture.date).toISOString()
        const { data: matchByKickoff } = await (supabase.from('matches') as any)
          .select('*')
          .eq('kickoff_at', kickoffIso)
          .maybeSingle()

        if (!matchByKickoff) continue

        match = matchByKickoff

        // Update api_football_id so future syncs hit by ID directly
        await (supabase.from('matches') as any)
          .update({ api_football_id: apiId })
          .eq('id', (match as any).id)
      }

      // Check if match already has result recorded to avoid duplicate trigger runs
      if ((match as any).home_goals_ft !== null && (match as any).status === statusShort) {
        continue
      }

      // Use score.fulltime for 90-minute result (business rule: only 90' counts)
      const hFt = fixture.score.fulltime.home ?? fixture.goals.home
      const aFt = fixture.score.fulltime.away ?? fixture.goals.away

      // result_ft MUST be in the SET clause — Postgres only fires
      // AFTER UPDATE OF result_ft when the column appears in the original SET list.
      // The set_match_result_ft BEFORE trigger also computes this, but the
      // on_match_result_award_points AFTER trigger won't fire without it here.
      const resultFt = (hFt != null && aFt != null)
        ? (hFt > aFt ? '1' : hFt < aFt ? '2' : 'X')
        : null

      const { error: updateError } = await (supabase.from('matches') as any)
        .update({
          status: statusShort,
          home_goals_ft: hFt,
          away_goals_ft: aFt,
          result_ft: resultFt,
          home_goals_aet: fixture.score.extratime.home,
          away_goals_aet: fixture.score.extratime.away,
          home_goals_pen: fixture.score.penalty.home,
          away_goals_pen: fixture.score.penalty.away,
          last_synced_at: new Date().toISOString(),
          synced_api_status: statusShort
        })
        .eq('id', (match as any).id)

      if (updateError) {
        console.error(`Failed to update match api_id=${apiId}:`, updateError.message)
      } else {
        matchesUpdated++
      }
    }

    const durationMs = Date.now() - startTime

    // Log the sync
    await (supabase.from('sync_logs') as any).insert({
      matches_checked: matchesChecked,
      matches_updated: matchesUpdated,
      api_calls_used: 1,
      duration_ms: durationMs,
      triggered_by: 'cron'
    })

    return {
      success: true,
      matchesChecked,
      matchesUpdated,
      apiCallsUsed: 1,
      durationMs
    }

  } catch (error: any) {
    const durationMs = Date.now() - startTime
    const errorMessage = error?.message || String(error)

    try {
      await (supabase.from('sync_logs') as any).insert({
        matches_checked: matchesChecked,
        matches_updated: matchesUpdated,
        api_calls_used: 1,
        duration_ms: durationMs,
        error_message: errorMessage,
        triggered_by: 'cron'
      })
    } catch (logError) {
      console.error('Failed to write error sync_log:', logError)
    }

    return {
      success: false,
      matchesChecked,
      matchesUpdated,
      apiCallsUsed: 1,
      durationMs,
      errorMessage
    }
  }
}
