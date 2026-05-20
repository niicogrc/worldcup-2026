import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PlayoffsClient from './playoffs-client'

export const dynamic = 'force-dynamic'

export default async function PlayoffsPage() {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch playoff matches
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

  // Fetch user predictions
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', user.id)

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-4xl font-bebas tracking-wider text-slate-100">
          PLAYOFFS BRACKET
        </h1>
        <p className="text-sm text-slate-400">
          Visualiza el bracket de las eliminatorias y predice el resultado al final de los <strong className="text-emerald-400">90 minutos reglamentarios</strong> (incluye la opción X de empate).
        </p>
      </div>

      <PlayoffsClient
        initialMatches={matches || []}
        initialPredictions={predictions || []}
      />
    </div>
  )
}
