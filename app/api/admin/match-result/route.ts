import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { match_id, home_goals_ft, away_goals_ft, home_goals_aet, away_goals_aet, home_goals_pen, away_goals_pen, status, home_team_id, away_team_id } = body

  if (!match_id || status === undefined) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const toNum = (v: unknown) => (v === '' || v === null || v === undefined) ? null : Number(v)

  const hFt = toNum(home_goals_ft)
  const aFt = toNum(away_goals_ft)

  // result_ft must be explicit in the SET clause so the AFTER UPDATE OF result_ft
  // trigger (on_match_result_award_points) fires and awards points
  const resultFt = (hFt != null && aFt != null && ['FT', 'AET', 'PEN'].includes(status))
    ? (hFt > aFt ? '1' : hFt < aFt ? '2' : 'X')
    : null

  const update: Record<string, unknown> = {
    status,
    home_goals_ft: hFt,
    away_goals_ft: aFt,
    result_ft: resultFt,
    home_goals_aet: toNum(home_goals_aet),
    away_goals_aet: toNum(away_goals_aet),
    home_goals_pen: toNum(home_goals_pen),
    away_goals_pen: toNum(away_goals_pen),
  }

  if ('home_team_id' in body) update.home_team_id = home_team_id || null
  if ('away_team_id' in body) update.away_team_id = away_team_id || null

  const db = createAdminClient() as any

  const { error } = await db
    .from('matches')
    .update(update)
    .eq('id', match_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
