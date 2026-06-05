import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

const TOTAL_MATCHES = 104

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [porrasRes, membersRes, predictionsRes, goldenBootRes, profilesRes, matchesRes] = await Promise.all([
    admin.from('porras').select('id, name').order('created_at', { ascending: true }),
    admin.from('porra_members').select('porra_id, user_id'),
    admin.from('predictions').select('porra_id, user_id, match_id'),
    admin.from('golden_boot_predictions').select('porra_id, user_id'),
    admin.from('profiles').select('id'),
    admin.from('matches').select('id, result_ft'),
  ])

  const porras: { id: string; name: string }[] = porrasRes.data ?? []
  const members: { porra_id: string; user_id: string }[] = membersRes.data ?? []
  const predictions: { porra_id: string; user_id: string; match_id: string }[] = predictionsRes.data ?? []
  const goldenBoot: { porra_id: string; user_id: string }[] = goldenBootRes.data ?? []
  const profiles: { id: string }[] = profilesRes.data ?? []
  const matchesAll: { id: string; result_ft: string | null }[] = matchesRes.data ?? []

  const porraStats = porras.map(porra => {
    const porraMembers = members.filter(m => m.porra_id === porra.id)
    const total_members = porraMembers.length
    const porraPredictions = predictions.filter(p => p.porra_id === porra.id)
    const total_predictions = porraPredictions.length
    const total_possible = total_members * TOTAL_MATCHES

    const predictionsPerUser = new Map<string, number>()
    for (const p of porraPredictions) {
      predictionsPerUser.set(p.user_id, (predictionsPerUser.get(p.user_id) ?? 0) + 1)
    }
    const members_with_all_predictions = porraMembers.filter(
      m => (predictionsPerUser.get(m.user_id) ?? 0) >= TOTAL_MATCHES
    ).length

    const goldenBootUserIds = new Set(
      goldenBoot.filter(g => g.porra_id === porra.id).map(g => g.user_id)
    )
    const members_with_golden_boot = porraMembers.filter(m => goldenBootUserIds.has(m.user_id)).length

    const completion_pct = total_possible > 0
      ? Math.round((total_predictions / total_possible) * 100 * 10) / 10
      : 0

    return {
      id: porra.id,
      name: porra.name,
      total_members,
      members_with_all_predictions,
      members_with_golden_boot,
      total_predictions,
      total_possible,
      completion_pct,
    }
  })

  const global = {
    total_users: profiles.length,
    total_predictions: predictions.length,
    matches_with_result: matchesAll.filter(m => m.result_ft !== null).length,
    matches_total: matchesAll.length,
  }

  return NextResponse.json({ porras: porraStats, global })
}
