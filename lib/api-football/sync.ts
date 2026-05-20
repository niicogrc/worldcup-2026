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

      // Look up match in DB
      const { data: match, error: fetchError } = await (supabase.from('matches') as any)
        .select('*')
        .eq('api_football_id', apiId)
        .maybeSingle()

      if (fetchError || !match) {
        // Match not seeded yet or query failed, skip
        continue
      }

      // Check if match already has result recorded to avoid duplicate trigger runs
      if ((match as any).home_goals_ft !== null && (match as any).status === statusShort) {
        continue
      }

      // Update match
      const { error: updateError } = await (supabase.from('matches') as any)
        .update({
          status: statusShort,
          home_goals_ft: fixture.goals.home,
          away_goals_ft: fixture.goals.away,
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
