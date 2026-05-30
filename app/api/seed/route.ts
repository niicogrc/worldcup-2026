import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { TournamentPhase } from '@/lib/supabase/types'

const OPENFOOTBALL_URL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'

function parseKickoffUTC(date: string, time: string): string {
  // time format: "13:00 UTC-6" or "15:00 UTC-4"
  const [clock, offsetPart] = time.split(' ')
  const [hours, minutes] = clock.split(':').map(Number)
  const offsetMatch = offsetPart.match(/UTC([+-]\d+)/)
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : 0

  const local = new Date(`${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00Z`)
  local.setUTCHours(local.getUTCHours() - offsetHours)
  return local.toISOString()
}

function mapRoundToPhase(round: string): TournamentPhase {
  const r = round.toLowerCase()
  if (r.includes('matchday') || r.includes('group')) return 'group'
  if (r.includes('32')) return 'round_of_32'
  if (r.includes('16')) return 'round_of_16'
  if (r.includes('quarter')) return 'quarter_final'
  if (r.includes('semi')) return 'semi_final'
  if (r.includes('third') || r.includes('3rd')) return 'third_place'
  if (r.includes('final')) return 'final'
  return 'group'
}

function isTBD(name: string): boolean {
  // openfootball uses codes like "2A", "W89", "L90" for knockout TBD teams
  return /^[0-9WL]/.test(name)
}

// FIFA/ISO country codes — overrides for teams where substring(0,3) is wrong or offensive
const TEAM_SHORT_CODES: Record<string, string> = {
  'Japan': 'JPN',
  'South Korea': 'KOR',
  'South Africa': 'RSA',
  'Austria': 'AUT',
  'Australia': 'AUS',
  'Iran': 'IRN',
  'Iraq': 'IRQ',
  'DR Congo': 'COD',
  'Netherlands': 'NED',
  'Switzerland': 'SUI',
  'Morocco': 'MAR',
  'Bosnia & Herzegovina': 'BIH',
  'Ivory Coast': 'CIV',
  'New Zealand': 'NZL',
  'Cape Verde': 'CPV',
}

function getShortCode(name: string): string {
  return TEAM_SHORT_CODES[name] ?? name.substring(0, 3).toUpperCase()
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Fetch openfootball data
    const res = await fetch(OPENFOOTBALL_URL)
    if (!res.ok) throw new Error(`Failed to fetch openfootball: ${res.statusText}`)
    const json = await res.json()
    const matches: any[] = json.matches || []

    const supabase = createAdminClient()

    // 2. Extract unique teams from group stage (knockout TBDs are codes, not real names)
    const teamsMap = new Map<string, { groupLetter: string }>()

    for (const m of matches) {
      if (!m.group) continue // skip knockout matches
      const groupLetter = (m.group as string).replace('Group ', '').trim()
      if (m.team1 && !isTBD(m.team1)) teamsMap.set(m.team1, { groupLetter })
      if (m.team2 && !isTBD(m.team2)) teamsMap.set(m.team2, { groupLetter })
    }

    // 3. Upsert teams
    const teamNameToId = new Map<string, string>()

    for (const [name, { groupLetter }] of teamsMap.entries()) {
      const { data: team, error } = await (supabase.from('teams') as any)
        .upsert(
          {
            name,
            group_letter: groupLetter,
            short_code: getShortCode(name),
          },
          { onConflict: 'name' }
        )
        .select('id')
        .single()

      if (error) {
        console.error(`Error upserting team "${name}":`, error.message)
        continue
      }
      if (team) teamNameToId.set(name, (team as any).id)
    }

    // 4. Upsert matches
    // api_football_id is not null in schema — use synthetic IDs (90001–90104) as
    // placeholders until API-Football grants access to season=2026 and we can sync real IDs.
    let matchesInserted = 0

    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      const phase = mapRoundToPhase(m.round)
      const groupLetter = m.group ? (m.group as string).replace('Group ', '').trim() : null
      const kickoff_at = parseKickoffUTC(m.date, m.time)
      const syntheticApiId = 90001 + i

      const homeTeamId = m.team1 && !isTBD(m.team1) ? teamNameToId.get(m.team1) ?? null : null
      const awayTeamId = m.team2 && !isTBD(m.team2) ? teamNameToId.get(m.team2) ?? null : null

      const { error } = await (supabase.from('matches') as any).upsert(
        {
          api_football_id: syntheticApiId,
          match_number: m.num ?? i + 1,
          phase,
          group_letter: groupLetter,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff_at,
          city: m.ground ?? null,
          status: 'NS',
        },
        { onConflict: 'api_football_id' }
      )

      if (error) {
        console.error(`Error upserting match #${i + 1}:`, error.message)
      } else {
        matchesInserted++
      }
    }

    return NextResponse.json({
      success: true,
      teamsInserted: teamNameToId.size,
      matchesInserted,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
