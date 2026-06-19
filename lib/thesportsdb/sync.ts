import { createAdminClient } from '@/lib/supabase/server'
import { getWorldCupFixturesByDate, WorldCupFixture } from '@/lib/thesportsdb/client'
import {
  discordNotificationsEnabled,
  notifyMatchResults,
  snapshotLeaderboard,
  type MatchUpdate,
} from '@/lib/notify'

// First match of the tournament (México vs Sudáfrica, 11 jun 2026).
const TOURNAMENT_START = '2026-06-11'

export interface SyncResult {
  success: boolean
  matchesChecked: number
  matchesUpdated: number
  apiCallsUsed: number
  durationMs: number
  needsManualReview?: number
  errorMessage?: string
}

interface Totals {
  checked: number
  updated: number
  manual: number
  // Matches that transitioned to FT this run, for the Discord notification.
  updates: MatchUpdate[]
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Inclusive list of UTC dates (YYYY-MM-DD) from `start` to `end`.
function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (cursor <= last) {
    dates.push(utcDay(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

// Apply one fixture to the DB. Matches by kickoff timestamp.
async function applyFixture(
  supabase: ReturnType<typeof createAdminClient>,
  fixture: WorldCupFixture,
  totals: Totals,
): Promise<void> {
  totals.checked++

  if (!fixture.finished) return

  // AET / PEN: TheSportsDB scores include extra time, so we can't derive the
  // 90' result. Per business rules only the 90' result counts, and reaching
  // AET means it was a draw at 90'. Skip and flag for manual admin entry.
  if (fixture.status === 'AET' || fixture.status === 'PEN') {
    totals.manual++
    console.warn(
      `match needs manual 90' entry: ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.kickoffIso}, status=${fixture.status})`,
    )
    return
  }

  if (fixture.status !== 'FT') return

  // Match the DB row by kickoff timestamp (the join key with TheSportsDB).
  const { data: match, error: fetchError } = await (supabase.from('matches') as any)
    .select('*')
    .eq('kickoff_at', fixture.kickoffIso)
    .maybeSingle()

  if (fetchError) {
    console.error(
      `DB lookup failed for ${fixture.homeTeam} vs ${fixture.awayTeam} (${fixture.kickoffIso}):`,
      fetchError.message,
    )
    return
  }

  // Fixture not in our DB (e.g. a TBD knockout slot, or kickoff time mismatch).
  if (!match) return

  // Idempotency: skip if the result is already recorded with the same status.
  if ((match as any).home_goals_ft !== null && (match as any).status === fixture.status) {
    return
  }

  const hFt = fixture.homeScore
  const aFt = fixture.awayScore

  // result_ft must be in the SET clause for the AFTER trigger
  // on_match_result_award_points (declared AFTER UPDATE OF result_ft) to fire.
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
      updateError.message,
    )
  } else {
    totals.updated++
    if (resultFt !== null && hFt != null && aFt != null) {
      totals.updates.push({
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        homeScore: hFt,
        awayScore: aFt,
        result: resultFt,
        phase: (match as any).phase,
      })
    }
  }
}

// Fetch the given UTC days from TheSportsDB and apply every finished match.
async function syncDates(dates: string[]): Promise<SyncResult> {
  const startTime = Date.now()
  const supabase = createAdminClient()
  const totals: Totals = { checked: 0, updated: 0, manual: 0, updates: [] }

  // Snapshot the leaderboard before applying results so we can report who
  // gained points / climbed. Skipped entirely if no Discord webhook is set.
  const wantNotify = discordNotificationsEnabled()
  const before = wantNotify ? await snapshotLeaderboard(supabase) : []

  try {
    for (const date of dates) {
      const fixtures = await getWorldCupFixturesByDate(date)
      for (const fixture of fixtures) {
        await applyFixture(supabase, fixture, totals)
      }
    }

    // Only notify when at least one match actually finished this run. The DB
    // trigger has already awarded points, so the "after" snapshot reflects them.
    let discordMessageId: string | null = null
    if (wantNotify && totals.updates.length > 0) {
      const after = await snapshotLeaderboard(supabase)
      const result = await notifyMatchResults({ matches: totals.updates, before, after })
      discordMessageId = result.messageId
    }

    const durationMs = Date.now() - startTime
    await (supabase.from('sync_logs') as any).insert({
      matches_checked: totals.checked,
      matches_updated: totals.updated,
      api_calls_used: dates.length,
      duration_ms: durationMs,
      triggered_by: 'cron',
      discord_message_id: discordMessageId,
    })

    return {
      success: true,
      matchesChecked: totals.checked,
      matchesUpdated: totals.updated,
      apiCallsUsed: dates.length,
      durationMs,
      needsManualReview: totals.manual,
    }
  } catch (error: any) {
    const durationMs = Date.now() - startTime
    const errorMessage = error?.message || String(error)

    try {
      await (supabase.from('sync_logs') as any).insert({
        matches_checked: totals.checked,
        matches_updated: totals.updated,
        api_calls_used: dates.length,
        duration_ms: durationMs,
        error_message: errorMessage,
        triggered_by: 'cron',
      })
    } catch (logError) {
      console.error('Failed to write error sync_log:', logError)
    }

    return {
      success: false,
      matchesChecked: totals.checked,
      matchesUpdated: totals.updated,
      apiCallsUsed: dates.length,
      durationMs,
      needsManualReview: totals.manual,
      errorMessage,
    }
  }
}

// Cron / on-demand sync. With no date, checks yesterday + today (covers
// matches that finish just after midnight UTC). Pass a YYYY-MM-DD to target
// a single day.
export async function syncTodayMatches(date?: string): Promise<SyncResult> {
  if (date) return syncDates([date])

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return syncDates([utcDay(yesterday), utcDay(today)])
}

// Full backfill: every day from the tournament start to today. One API call
// per day. Used by the admin "Sincronizar y recalcular" / backfill endpoint.
export async function backfillAllMatches(): Promise<SyncResult> {
  return syncDates(enumerateDates(TOURNAMENT_START, utcDay(new Date())))
}
