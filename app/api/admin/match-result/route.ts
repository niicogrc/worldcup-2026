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

  const update: Record<string, unknown> = {
    status,
    home_goals_ft: toNum(home_goals_ft),
    away_goals_ft: toNum(away_goals_ft),
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
