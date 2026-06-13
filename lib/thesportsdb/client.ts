import { MatchStatus } from '@/lib/supabase/types'

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json'
const WORLD_CUP_LEAGUE_ID = '4429'

// Raw API event (only the fields we read; all values are strings per the API)
export interface TheSportsDbEvent {
  idEvent: string
  idLeague: string
  strHomeTeam: string
  strAwayTeam: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string | null
  strTimestamp: string | null
  dateEvent: string | null
  intRound: string | null
  strPostponed: string | null
}

// Normalized fixture the rest of the app consumes
export interface WorldCupFixture {
  sourceId: string          // idEvent
  homeTeam: string
  awayTeam: string
  homeScore: number | null  // parsed from intHomeScore (null if missing/empty)
  awayScore: number | null
  status: MatchStatus       // mapped via mapStatus()
  kickoffIso: string        // full ISO UTC, e.g. "2026-06-11T19:00:00.000Z"
  round: string | null      // intRound
  finished: boolean         // true when status is 'FT' | 'AET' | 'PEN'
}

const FINISHED_STATUSES = new Set<MatchStatus>(['FT', 'AET', 'PEN'])

const VALID_PASSTHROUGH_STATUSES = new Set<string>([
  'NS', '1H', 'HT', '2H', 'ET', 'P', 'FT', 'AET', 'PEN', 'PST', 'CANC', 'SUSP', 'ABD',
])

export function mapStatus(
  rawStatus: string | null,
  postponed?: string | null,
): MatchStatus {
  if (postponed === 'yes') return 'PST'
  if (rawStatus === null) return 'NS'
  if (VALID_PASSTHROUGH_STATUSES.has(rawStatus)) return rawStatus as MatchStatus
  if (rawStatus === 'Match Finished') return 'FT'
  if (rawStatus === 'Not Started') return 'NS'
  return 'NS'
}

function parseScore(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function mapEvent(event: TheSportsDbEvent): WorldCupFixture | null {
  if (!event.strTimestamp) return null

  const ts = event.strTimestamp
  // strTimestamp is UTC without a trailing Z; treat it as UTC.
  const kickoffIso = new Date(ts.endsWith('Z') ? ts : ts + 'Z').toISOString()
  const status = mapStatus(event.strStatus, event.strPostponed)

  return {
    sourceId: event.idEvent,
    homeTeam: event.strHomeTeam,
    awayTeam: event.strAwayTeam,
    homeScore: parseScore(event.intHomeScore),
    awayScore: parseScore(event.intAwayScore),
    status,
    kickoffIso,
    round: event.intRound,
    finished: FINISHED_STATUSES.has(status),
  }
}

// Fetch all World Cup 2026 fixtures for a single UTC day (YYYY-MM-DD).
//
// We query per-day via `eventsday` rather than `eventsseason` because the free
// tier caps `eventsseason` to a ~15-event rolling window around "now", which
// silently drops already-played matches and makes backfill unreliable.
export async function getWorldCupFixturesByDate(date: string): Promise<WorldCupFixture[]> {
  const apiKey = process.env.THESPORTSDB_KEY ?? '3'
  const url = `${BASE_URL}/${apiKey}/eventsday.php?d=${date}&l=${WORLD_CUP_LEAGUE_ID}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `TheSportsDB request failed: ${response.statusText} (${response.status})`,
    )
  }

  const data: { events: TheSportsDbEvent[] | null } = await response.json()
  if (!data.events) return []

  return data.events
    .filter(e => e.idLeague === WORLD_CUP_LEAGUE_ID)
    .map(mapEvent)
    .filter((f): f is WorldCupFixture => f !== null)
}
