import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import PlayoffsClient from './playoffs-client'

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
  }

  const { data: predictions } = await (supabase as any)
    .from('predictions')
    .select('*')
    .eq('porra_id', porraId)
    .eq('user_id', user.id)

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
      />
    </div>
  )
}
