import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import GoldenBootClient from './golden-boot-client'

export const dynamic = 'force-dynamic'

export default async function GoldenBootPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  const { data: prediction } = await (supabase as any)
    .from('golden_boot_predictions')
    .select(`
      *,
      team:teams(id, name, flag_url)
    `)
    .eq('porra_id', porraId)
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_code, flag_url')
    .order('name', { ascending: true })

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
        porraId={porraId}
      />
    </div>
  )
}
