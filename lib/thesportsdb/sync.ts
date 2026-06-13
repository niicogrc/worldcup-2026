import { createAdminClient } from '@/lib/supabase/server'
import { getWorldCupFixtures } from '@/lib/thesportsdb/client'

export interface SyncResult {
  success: boolean
  matchesChecked: number
  matchesUpdated: number
  apiCallsUsed: number
  durationMs: number
  needsManualReview?: number
  errorMessage?: string
}

// date: YYYY-MM-DD to process only that day's fixtures; omit to process all tournament fixtures (backfill)
export async function syncTodayMatches(date?: string): Promise<SyncResult> {
  const startTime = Date.now()
  let matchesChecked = 0
  let matchesUpdated = 0
  let needsManualReview = 0
  const supabase = createAdminClient()

  try {
    // Fetch all WC 2026 fixtures from TheSportsDB (one call covers the full season)
    const allFixtures = await getWorldCupFixtures()

    // Filter by date if provided (YYYY-MM-DD prefix match on kickoffIso)
    const fixtures = date
      ? allFixtures.filter(f => f.kickoffIso.startsWith(date))
      : allFixtures

    matchesChecked = fixtures.length

    for (const fixture of fixtures) {
      // Only act on finished matches
      if (!fixture.finished) continue

      // AET / PEN: TheSportsDB scores include extra time — cannot auto-derive the 90' result.
      // Per business rules only the 90' result counts and a match going to AET was a draw at 90'.
      // Skip and flag for manual admin entry.
      if (fixture.status === 'AET' || fixture.status === 'PEN') {
        needsManualReview++
        console.warn(
          `match needs manual 90' entry: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.kickoffIso}, status=${fixture.status})`
        )
        continue
      }

      // Only FT reaches here
      if (fixture.status !== 'FT') continue

      // Match DB row by kickoff timestamp (the join key with TheSportsDB)
      const { data: match, error: fetchError } = await (supabase.from('matches') as any)
        .select('*')
        .eq('kickoff_at', fixture.kickoffIso)
        .maybeSingle()

      if (fetchError) {
        console.error(
          `DB lookup failed for ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.kickoffIso}):`,
          fetchError.message
        )
        continue
      }

      // Fixture not in our DB yet (e.g., TBD knockout slot)
      if (!match) continue

      // Idempotency: skip if result already recorded with same status
      if ((match as any).home_goals_ft !== null && (match as any).status === fixture.status) {
        continue
      }

      const hFt = fixture.homeScore
      const aFt = fixture.awayScore

      // Compute result_ft — must be included in SET for the AFTER trigger
      // on_match_result_award_points to fire (declared AFTER UPDATE OF result_ft).
      const resultFt = (hFt != null && aFt != null)
        ? (hFt > aFt ? '1' : hFt < aFt ? '2' : 'X')
        : null

      const { error: updateError } = await (supabase.from('matches') as any)
        .update({
          status: 'FT',
          home_goals_ft: hFt,
          away_goals_ft: aFt,
          result_ft: resultFt,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', (match as any).id)

      if (updateError) {
        console.error(
          `Failed to update match ${fixture.homeTeam} vs ${fixture.awayTeam}:`,
          updateError.message
        )
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
      triggered_by: 'cron',
    })

    return {
      success: true,
      matchesChecked,
      matchesUpdated,
      apiCallsUsed: 1,
      durationMs,
      needsManualReview,
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
        triggered_by: 'cron',
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
      needsManualReview,
      errorMessage,
    }
  }
}
