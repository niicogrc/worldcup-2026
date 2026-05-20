const BASE_URL = 'https://v3.football.api-sports.io'

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number>
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const apiKey = process.env.API_FOOTBALL_KEY
  if (!apiKey) {
    throw new Error('API_FOOTBALL_KEY is not defined in environment variables')
  }

  const url = new URL(`${BASE_URL}${endpoint}`)
  if (options.params) {
    Object.entries(options.params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'x-apisports-key': apiKey,
      'Accept': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API-Football request failed: ${response.statusText} (${response.status})`)
  }

  const data = await response.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`API-Football returned errors: ${JSON.stringify(data.errors)}`)
  }

  return data
}

export interface ApiFootballFixture {
  fixture: {
    id: number
    referee: string | null
    timezone: string
    date: string
    timestamp: number
    periods: {
      first: number | null
      second: number | null
    }
    venue: {
      id: number | null
      name: string
      city: string
    }
    status: {
      long: string
      short: string
      elapsed: number | null
    }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    round: string
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
    away: {
      id: number
      name: string
      logo: string
      winner: boolean | null
    }
  }
  goals: {
    home: number | null
    away: number | null
  }
  score: {
    halftime: {
      home: number | null
      away: number | null
    }
    fulltime: {
      home: number | null
      away: number | null
    }
    extratime: {
      home: number | null
      away: number | null
    }
    penalty: {
      home: number | null
      away: number | null
    }
  }
}

export interface ApiFootballStandings {
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string | null
    season: number
    standings: Array<
      Array<{
        rank: number
        team: {
          id: number
          name: string
          logo: string
        }
        points: number
        goalsDiff: number
        group: string
        form: string
        status: string
        description: string | null
        all: {
          played: number
          win: number
          draw: number
          lose: number
          goals: {
            for: number
            against: number
          }
        }
      }>
    >
  }
}

export async function getFixtures(date?: string): Promise<ApiFootballFixture[]> {
  const params: Record<string, string | number> = {
    league: 1,
    season: 2026,
  }
  if (date) {
    params.date = date
  }

  const data = await apiFetch<{ response: ApiFootballFixture[] }>('/fixtures', { params })
  return data.response
}

export async function getStandings(): Promise<ApiFootballStandings['league']['standings']> {
  const params = {
    league: 1,
    season: 2026,
  }

  const data = await apiFetch<{ response: ApiFootballStandings[] }>('/standings', { params })
  return data.response[0]?.league?.standings || []
}
