import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import PlayoffsClient from './playoffs-client'
import EmptyState from '@/components/ui/empty-state'
import { DatabaseZap } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlayoffsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select(`
      *,
      home_team:teams!matches_home_team_id_fkey(id, name, flag_url, short_code),
      away_team:teams!matches_away_team_id_fkey(id, name, flag_url, short_code)
    `)
    .neq('phase', 'group')
    .order('kickoff_at', { ascending: true })

  if (matchesError) {
    console.error('Error fetching playoff matches:', matchesError.message)
    return (
      <EmptyState
        title="No se pudieron cargar los playoffs"
        description="Hubo un problema al obtener los datos de la fase eliminatoria. Puede que las tablas aún no existan o que el servicio no esté disponible."
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Playoffs</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Predice el resultado al final de los 90 minutos (1-X-2). Las prórrogas y penaltis no cuentan.</p>
      </div>

      <PlayoffsClient
        initialMatches={matches || []}
        initialPredictions={predictions || []}
        porraId={porraId}
        members={members}
        currentUserId={user.id}
      />
    </div>
  )
}
