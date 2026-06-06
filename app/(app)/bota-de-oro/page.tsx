import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import { getActivePorraId } from '@/lib/active-porra'
import GoldenBootClient from './golden-boot-client'
import EmptyState from '@/components/ui/empty-state'
import { DatabaseZap } from 'lucide-react'

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

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, short_code, flag_url')
    .order('name', { ascending: true })

  if (teamsError) {
    console.error('Error fetching teams:', teamsError.message)
    return (
      <EmptyState
        title="No se pudo cargar la Bota de Oro"
        description="Hubo un problema al obtener los equipos. Puede que las tablas aún no existan o que el servicio no esté disponible."
        icon={DatabaseZap}
        action={{ label: 'Volver al leaderboard', href: '/dashboard' }}
      />
    )
  }

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
