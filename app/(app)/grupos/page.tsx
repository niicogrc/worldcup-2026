import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GroupsClient from './groups-client'

export const dynamic = 'force-dynamic'

export default async function GruposPage() {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch matches in group phase
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

  // Fetch user predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)

  // Fetch group standings
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
      />
    </div>
  )
}
