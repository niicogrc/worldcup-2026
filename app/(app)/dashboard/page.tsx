import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import LeaderboardClient from './leaderboard-client'
import EmptyState from '@/components/ui/empty-state'
import { DatabaseZap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  const adminIds = (adminProfiles ?? []).map((p: any) => p.id)

  let query = (supabase as any)
    .from('leaderboard')
    .select('*')
    .eq('porra_id', porraId)
    .order('position', { ascending: true })
  for (const id of adminIds) query = query.neq('user_id', id)
  const { data: leaderboard, error: lbError } = await query

  if (lbError) {
    console.error('Error fetching leaderboard:', lbError.message)
    return (
      <EmptyState
        title="No se pudo cargar el leaderboard"
        description="Hubo un problema al obtener la clasificación. Puede que las tablas aún no existan o que el servicio no esté disponible."
        icon={DatabaseZap}
      />
    )
  }

  const { data: userScore } = await (supabase as any)
    .from('scores')
    .select('*')
    .eq('porra_id', porraId)
    .eq('user_id', user.id)
    .single()

  // Historial de los últimos 5 partidos jugados, por jugador (orden cronológico).
  const { data: completedMatches } = await (supabase as any)
    .from('matches')
    .select('id, kickoff_at')
    .not('result_ft', 'is', null)
    .order('kickoff_at', { ascending: true })

  const completed = (completedMatches as any[]) ?? []
  const matchOrder = new Map<string, number>(completed.map((m: any, i: number) => [m.id, i]))
  const completedIds = completed.map((m: any) => m.id)

  const historyByUser: Record<string, { pts: number; ok: boolean }[]> = {}
  if (completedIds.length > 0) {
    const { data: preds } = await (supabase as any)
      .from('predictions')
      .select('user_id, match_id, points_awarded, is_correct')
      .eq('porra_id', porraId)
      .in('match_id', completedIds)

    const grouped: Record<string, { order: number; pts: number; ok: boolean }[]> = {}
    for (const p of (preds as any[]) ?? []) {
      const order = matchOrder.get(p.match_id)
      if (order === undefined) continue
      ;(grouped[p.user_id] ??= []).push({
        order,
        pts: p.points_awarded ?? 0,
        ok: Boolean(p.is_correct),
      })
    }
    for (const [uid, rows] of Object.entries(grouped)) {
      historyByUser[uid] = rows
        .sort((a, b) => a.order - b.order)
        .slice(-5)
        .map(({ pts, ok }) => ({ pts, ok }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Clasificación oficial en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-[#13151c] border border-[#1f2333] text-blue-400 py-1.5 px-3 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          En directo
        </div>
      </div>

      <LeaderboardClient
        initialLeaderboard={leaderboard || []}
        currentUserId={user.id}
        userScore={userScore}
        historyByUser={historyByUser}
      />
    </div>
  )
}
