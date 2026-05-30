import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

const PHASE_POINTS: Record<string, number> = {
  group: 3,
  round_of_32: 3,
  round_of_16: 3,
  quarter_final: 6,
  semi_final: 8,
  third_place: 5,
  final: 15,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient() as any

  const { data: completedMatches, error: matchError } = await admin
    .from('matches')
    .select('id, phase, result_ft')
    .not('result_ft', 'is', null)

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

  const completed = (completedMatches as any[]) ?? []
  if (completed.length === 0) {
    return NextResponse.json({ success: true, message: 'Sin partidos completados', predictionsProcessed: 0, usersUpdated: 0 })
  }

  const matchMap = new Map(completed.map((m: any) => [m.id, m]))
  const completedMatchIds = completed.map((m: any) => m.id)

  const { data: predictions, error: predError } = await admin
    .from('predictions')
    .select('id, user_id, match_id, prediction')
    .in('match_id', completedMatchIds)

  if (predError) return NextResponse.json({ error: predError.message }, { status: 500 })

  const preds = (predictions as any[]) ?? []

  // Build per-prediction updates and per-user score aggregates
  const predUpdates: { id: string; is_correct: boolean; points_awarded: number }[] = []
  const userScores: Record<string, Record<string, number>> = {}

  for (const pred of preds) {
    const match = matchMap.get(pred.match_id)
    if (!match) continue

    const isCorrect = pred.prediction === match.result_ft
    const pts = isCorrect ? (PHASE_POINTS[match.phase] ?? 0) : 0
    predUpdates.push({ id: pred.id, is_correct: isCorrect, points_awarded: pts })

    if (isCorrect) {
      if (!userScores[pred.user_id]) userScores[pred.user_id] = {}
      const pKey = `points_${match.phase}`
      const cKey = `correct_${match.phase}`
      userScores[pred.user_id][pKey] = (userScores[pred.user_id][pKey] ?? 0) + pts
      userScores[pred.user_id][cKey] = (userScores[pred.user_id][cKey] ?? 0) + 1
    }
  }

  // Reset match-based scores for all users (preserve points_golden_boot)
  const { data: allScores } = await admin.from('scores').select('user_id')
  const resetObj = {
    points_group: 0, correct_group: 0,
    points_round_of_32: 0, correct_round_of_32: 0,
    points_round_of_16: 0, correct_round_of_16: 0,
    points_quarter_final: 0, correct_quarter_final: 0,
    points_semi_final: 0, correct_semi_final: 0,
    points_third_place: 0, correct_third_place: 0,
    points_final: 0, correct_final: 0,
  }
  for (const row of (allScores as any[]) ?? []) {
    await admin.from('scores').update(resetObj).eq('user_id', row.user_id)
  }

  // Update prediction correctness
  for (const pu of predUpdates) {
    await admin.from('predictions')
      .update({ is_correct: pu.is_correct, points_awarded: pu.points_awarded } as any)
      .eq('id', pu.id)
  }

  // Apply aggregated scores
  for (const [userId, scoreUpdate] of Object.entries(userScores)) {
    await admin.from('scores').update(scoreUpdate as any).eq('user_id', userId)
  }

  return NextResponse.json({
    success: true,
    predictionsProcessed: predUpdates.length,
    usersUpdated: Object.keys(userScores).length,
  })
}
