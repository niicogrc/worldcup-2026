import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import GroupsClient from './groups-client'

export const dynamic = 'force-dynamic'

export default async function GruposPage() {
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
  }

  const { data: predictions } = await (supabase as any)
    .from('predictions')
    .select('*')
    .eq('porra_id', porraId)
    .eq('user_id', user.id)

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
      />
    </div>
  )
}
