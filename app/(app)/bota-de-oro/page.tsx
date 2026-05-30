import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import GoldenBootClient from './golden-boot-client'

export const dynamic = 'force-dynamic'

export default async function GoldenBootPage() {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch prediction if exists
  const { data: prediction } = await supabase
    .from('golden_boot_predictions')
    .select(`
      *,
      team:teams(id, name, flag_url)
    `)
    .eq('user_id', user.id)
    .maybeSingle()

  // Fetch all teams for selection
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_code, flag_url')
    .order('name', { ascending: true })

  // Fetch first match kickoff to check lock status
  const { data: firstMatch } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const firstMatchKickoff = firstMatch ? (firstMatch as any).kickoff_at : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Bota de Oro 🏆</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Elige al máximo goleador del Mundial 2026.</p>
      </div>

      <GoldenBootClient
        initialPrediction={prediction || null}
        teams={teams || []}
        firstMatchKickoff={firstMatchKickoff}
      />
    </div>
  )
}
