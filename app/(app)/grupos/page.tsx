import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import GroupsClient from './groups-client'
import EmptyState from '@/components/ui/empty-state'
import { DatabaseZap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function GruposPage({ searchParams }: { searchParams: Promise<{ member?: string }> }) {
  const { member } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, name, flag_url, group_letter, short_code),
      away_team:teams!matches_away_team_id_fkey(id, name, flag_url, group_letter, short_code)
    `)
    .eq('phase', 'group')
    .order('kickoff_at', { ascending: true })

  if (matchesError) {
    console.error('Error fetching matches:', matchesError.message)
    return (
      <EmptyState
        title="No se pudieron cargar los partidos"
        description="Hubo un problema al obtener los datos de la fase de grupos. Puede que las tablas aún no existan o que el servicio no esté disponible."
        icon={DatabaseZap}
        action={{ label: 'Volver al leaderboard', href: '/dashboard' }}
      />
    )
  }

  const { data: predictions } = await (supabase as any)
    .from('predictions')
    .select('*')
    .eq('porra_id', porraId)
    .eq('user_id', user.id)

  // Si no tiene predicciones en esta porra, ofrecer importarlas desde otra
  // porra suya donde sí las tenga
  let importablePorras: { id: string; name: string }[] = []
  if ((predictions ?? []).length === 0) {
    const { data: otherPreds } = await (supabase as any)
      .from('predictions')
      .select('porra_id')
      .eq('user_id', user.id)
      .neq('porra_id', porraId)

    const otherIds = [...new Set((otherPreds ?? []).map((p: any) => p.porra_id))]
    if (otherIds.length > 0) {
      const { data: otherPorras } = await (supabase as any)
        .from('porras')
        .select('id, name')
        .in('id', otherIds)
      importablePorras = otherPorras ?? []
    }
  }

  // Miembros de la porra activa, para poder ver las predicciones de otros
  const { data: memberRows } = await (supabase as any)
    .from('porra_members')
    .select('user_id, profiles:user_id(display_name, avatar_url)')
    .eq('porra_id', porraId)

  const members = (memberRows ?? []).map((m: any) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name ?? 'Usuario',
    avatar_url: m.profiles?.avatar_url ?? null,
  }))

  const { data: standings } = await supabase
    .from('group_standings')
    .select(`
      *,
      team:teams(id, name, flag_url, short_code)
    `)
    .order('position', { ascending: true })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Fase de Grupos</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Predice el resultado (1-X-2) de los 72 partidos. Las apuestas cierran al inicio de cada partido.</p>
      </div>

      <GroupsClient
        initialMatches={matches || []}
        initialPredictions={predictions || []}
        standings={standings || []}
        porraId={porraId}
        importablePorras={importablePorras}
        members={members}
        currentUserId={user.id}
        initialViewUserId={member ?? null}
      />
    </div>
  )
}
