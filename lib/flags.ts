// Maps team names (as stored in openfootball/teams table) to ISO 3166-1 alpha-2 codes
// flagcdn.com URL: https://flagcdn.com/w20/{code}.png
const TEAM_FLAG_CODES: Record<string, string> = {
  // Group A
  'Mexico':                 'mx',
  'South Africa':           'za',
  'South Korea':            'kr',
  'Czech Republic':         'cz',
  // Group B
  'Bosnia & Herzegovina':   'ba',
  'Canada':                 'ca',
  'Qatar':                  'qa',
  'Switzerland':            'ch',
  // Group C
  'Brazil':                 'br',
  'Haiti':                  'ht',
  'Morocco':                'ma',
  'Scotland':               'gb-sct',
  // Group D
  'Australia':              'au',
  'Paraguay':               'py',
  'Turkey':                 'tr',
  'USA':                    'us',
  // Group E
  'Curaçao':                'cw',
  'Ecuador':                'ec',
  'Germany':                'de',
  'Ivory Coast':            'ci',
  // Group F
  'Japan':                  'jp',
  'Netherlands':            'nl',
  'Sweden':                 'se',
  'Tunisia':                'tn',
  // Group G
  'Belgium':                'be',
  'Egypt':                  'eg',
  'Iran':                   'ir',
  'New Zealand':            'nz',
  // Group H
  'Cape Verde':             'cv',
  'Saudi Arabia':           'sa',
  'Spain':                  'es',
  'Uruguay':                'uy',
  // Group I
  'France':                 'fr',
  'Iraq':                   'iq',
  'Norway':                 'no',
  'Senegal':                'sn',
  // Group J
  'Algeria':                'dz',
  'Argentina':              'ar',
  'Austria':                'at',
  'Jordan':                 'jo',
  // Group K
  'Colombia':               'co',
  'DR Congo':               'cd',
  'Portugal':               'pt',
  'Uzbekistan':             'uz',
  // Group L
  'Croatia':                'hr',
  'England':                'gb-eng',
  'Ghana':                  'gh',
  'Panama':                 'pa',
}

export function getFlagUrl(teamName: string): string | null {
  const code = TEAM_FLAG_CODES[teamName]
  if (!code) return null
  return `https://flagcdn.com/w40/${code}.png`
}
