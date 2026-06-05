import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import AdminClient from './admin-client'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) redirect('/dashboard')

  const admin = createAdminClient()

  let profiles: any[] = []
  let scores: any[] = []
  let matches: any[] = []
  let syncLogs: any[] = []
  let goldenBoot: any[] = []
  let authUsers: any[] = []
  let teams: any[] = []

  try {
    const [
      profilesRes,
      scoresRes,
      matchesRes,
      syncLogsRes,
      goldenBootRes,
      authUsersRes,
      teamsRes,
    ] = await Promise.all([
      admin.from('profiles').select('id, display_name, avatar_url').order('display_name'),
      admin.from('scores').select('porra_id, user_id, total_points, total_points_groups, total_points_playoffs, points_golden_boot'),
      admin.from('matches').select(`
        id, phase, match_number, group_letter, kickoff_at, venue, city, status,
        home_goals_ft, away_goals_ft, home_goals_aet, away_goals_aet, home_goals_pen, away_goals_pen,
        result_ft, last_synced_at,
        home_team_id, away_team_id,
        home_team:teams!matches_home_team_id_fkey(name, name_es, short_code),
        away_team:teams!matches_away_team_id_fkey(name, name_es, short_code)
      `).order('kickoff_at', { ascending: true }),
      admin.from('sync_logs').select('*').order('synced_at', { ascending: false }).limit(30),
      admin.from('golden_boot_predictions').select(`
        id, user_id, player_name, is_locked, created_at,
        profile:profiles(display_name),
        team:teams(name_es, name)
      `).order('created_at'),
      admin.auth.admin.listUsers({ perPage: 200 }),
      admin.from('teams').select('id, name, name_es, short_code').order('name_es', { ascending: true, nullsFirst: false }),
    ])

    profiles = profilesRes.data as any[] ?? []
    scores = scoresRes.data as any[] ?? []
    matches = matchesRes.data as any[] ?? []
    syncLogs = syncLogsRes.data as any[] ?? []
    goldenBoot = goldenBootRes.data as any[] ?? []
    authUsers = authUsersRes.data?.users ?? []
    teams = teamsRes.data as any[] ?? []
  } catch (err) {
    console.error('[admin] Error fetching data:', err)
  }

  // Aggregate scores across all porras per user
  const scoreMap = new Map<string, { total_points: number; total_points_groups: number; total_points_playoffs: number; points_golden_boot: number }>()
  for (const s of scores) {
    const prev = scoreMap.get(s.user_id) ?? { total_points: 0, total_points_groups: 0, total_points_playoffs: 0, points_golden_boot: 0 }
    scoreMap.set(s.user_id, {
      total_points: prev.total_points + (s.total_points ?? 0),
      total_points_groups: prev.total_points_groups + (s.total_points_groups ?? 0),
      total_points_playoffs: prev.total_points_playoffs + (s.total_points_playoffs ?? 0),
      points_golden_boot: Math.max(prev.points_golden_boot, s.points_golden_boot ?? 0),
    })
  }
  const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? '']))

  const users = profiles.map(p => ({
    id: p.id,
    email: emailMap.get(p.id) ?? '',
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    total_points: scoreMap.get(p.id)?.total_points ?? 0,
    total_points_groups: scoreMap.get(p.id)?.total_points_groups ?? 0,
    total_points_playoffs: scoreMap.get(p.id)?.total_points_playoffs ?? 0,
    points_golden_boot: scoreMap.get(p.id)?.points_golden_boot ?? 0,
  })).sort((a, b) => b.total_points - a.total_points)

  const formattedMatches = matches.map(m => ({
    id: m.id,
    phase: m.phase,
    match_number: m.match_number,
    group_letter: m.group_letter,
    kickoff_at: m.kickoff_at,
    venue: m.venue,
    city: m.city,
    status: m.status,
    home_goals_ft: m.home_goals_ft,
    away_goals_ft: m.away_goals_ft,
    home_goals_aet: m.home_goals_aet,
    away_goals_aet: m.away_goals_aet,
    home_goals_pen: m.home_goals_pen,
    away_goals_pen: m.away_goals_pen,
    result_ft: m.result_ft,
    last_synced_at: m.last_synced_at,
    home_team_id: m.home_team_id,
    away_team_id: m.away_team_id,
    home_team: m.home_team,
    away_team: m.away_team,
  }))

  const formattedGoldenBoot = goldenBoot.map(g => ({
    id: g.id,
    user_id: g.user_id,
    player_name: g.player_name,
    is_locked: g.is_locked,
    created_at: g.created_at,
    display_name: g.profile?.display_name ?? '—',
    team_name: g.team?.name_es ?? g.team?.name ?? null,
  }))

  return (
    <AdminClient
      users={users}
      matches={formattedMatches}
      syncLogs={syncLogs}
      goldenBootPredictions={formattedGoldenBoot}
      teams={teams}
    />
  )
}
