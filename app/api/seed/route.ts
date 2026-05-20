import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { TournamentPhase } from '@/lib/supabase/types'

const API_FOOTBALL_URL = 'https://v3.football.api-sports.io/fixtures?league=1&season=2026'

function mapRoundToPhase(round: string): { phase: TournamentPhase; groupLetter: string | null } {
  const r = round.toLowerCase()
  if (r.includes('group')) {
    const match = r.match(/group\s+([a-l])/i) || r.match(/stage\s*-\s*([a-l])/i) || r.match(/-\s*([a-l])/i)
    const letter = match ? match[1].toUpperCase() : null
    return { phase: 'group', groupLetter: letter }
  }
  if (r.includes('32') || r.includes('thirty-two')) return { phase: 'round_of_32', groupLetter: null }
  if (r.includes('16') || r.includes('sixteen')) return { phase: 'round_of_16', groupLetter: null }
  if (r.includes('quarter')) return { phase: 'quarter_final', groupLetter: null }
  if (r.includes('semi')) return { phase: 'semi_final', groupLetter: null }
  if (r.includes('third') || r.includes('3rd') || r.includes('3rd place')) return { phase: 'third_place', groupLetter: null }
  if (r.includes('final')) return { phase: 'final', groupLetter: null }
  
  return { phase: 'group', groupLetter: null }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validate Cron Secret Header
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured on the server' }, { status: 500 })
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.API_FOOTBALL_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API_FOOTBALL_KEY is not configured' }, { status: 500 })
    }

    // 2. Fetch all fixtures from API-Football
    const response = await fetch(API_FOOTBALL_URL, {
      headers: {
        'x-apisports-key': apiKey,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch fixtures: ${response.statusText}`)
    }

    const json = await response.json()
    if (json.errors && Object.keys(json.errors).length > 0) {
      return NextResponse.json({ error: 'API-Football errors', details: json.errors }, { status: 400 })
    }

    const fixtures = json.response || []
    if (fixtures.length === 0) {
      return NextResponse.json({ message: 'No fixtures returned from API-Football' }, { status: 200 })
    }

    const supabase = createAdminClient()

    // 3. Extract and insert unique teams
    const teamsMap = new Map<number, { name: string; groupLetter: string | null }>()
    
    fixtures.forEach((fix: any) => {
      const home = fix.teams.home
      const away = fix.teams.away
      const roundInfo = mapRoundToPhase(fix.league.round)
      
      if (home && home.id) {
        teamsMap.set(home.id, { 
          name: home.name, 
          groupLetter: roundInfo.phase === 'group' ? roundInfo.groupLetter : null 
        })
      }
      if (away && away.id) {
        teamsMap.set(away.id, { 
          name: away.name, 
          groupLetter: roundInfo.phase === 'group' ? roundInfo.groupLetter : null 
        })
      }
    })

    const insertedTeams: Record<string, string> = {} // maps api_football_id -> DB uuid
    
    for (const [apiId, teamData] of Array.from(teamsMap.entries())) {
      // Upsert team
      const { data: team, error: teamError } = await (supabase.from('teams') as any)
        .upsert({
          api_football_id: apiId,
          name: teamData.name,
          group_letter: teamData.groupLetter,
          short_code: teamData.name.substring(0, 3).toUpperCase() // placeholder short code
        }, { onConflict: 'api_football_id' })
        .select()
        .single()

      if (teamError) {
        console.error(`Error inserting team ${teamData.name}:`, teamError.message)
        continue
      }
      if (team) {
        insertedTeams[apiId] = (team as any).id
      }
    }

    // 4. Insert matches
    let matchesCount = 0
    
    for (const fix of fixtures) {
      const apiId = fix.fixture.id
      const roundInfo = mapRoundToPhase(fix.league.round)
      const homeTeamDbId = fix.teams.home?.id ? insertedTeams[fix.teams.home.id] : null
      const awayTeamDbId = fix.teams.away?.id ? insertedTeams[fix.teams.away.id] : null

      if (!homeTeamDbId || !awayTeamDbId) {
        // Skip match if teams couldn't be loaded/mapped
        continue
      }

      // Upsert match
      const { error: matchError } = await (supabase.from('matches') as any)
        .upsert({
          api_football_id: apiId,
          phase: roundInfo.phase,
          group_letter: roundInfo.groupLetter,
          home_team_id: homeTeamDbId,
          away_team_id: awayTeamDbId,
          kickoff_at: fix.fixture.date,
          venue: fix.fixture.venue?.name || null,
          city: fix.fixture.venue?.city || null,
          status: 'NS'
        }, { onConflict: 'api_football_id' })

      if (matchError) {
        console.error(`Error inserting match api_id=${apiId}:`, matchError.message)
      } else {
        matchesCount++
      }
    }

    return NextResponse.json({
      success: true,
      teamsInserted: Object.keys(insertedTeams).length,
      matchesInserted: matchesCount
    }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
