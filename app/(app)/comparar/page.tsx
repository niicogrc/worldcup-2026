import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { getActivePorraId } from '@/lib/active-porra'
import { clsx } from 'clsx'
import CompararForm from './comparar-form'

export const dynamic = 'force-dynamic'

const PHASE_LABELS: Record<string, string> = {
  group: 'Grupos',
  round_of_32: '1/32',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semis',
  third_place: '3er puesto',
  final: 'Final',
}

function Avatar({ name, avatarUrl, size = 'md' }: { name: string; avatarUrl: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-lg' }
  const initials = name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  const src = avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(name)}&backgroundColor=1f2333`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      title={initials}
      className={clsx('rounded-full bg-[#1f2333] flex-shrink-0 object-cover', sizeClasses[size])}
    />
  )
}

function PredBadge({ pred, correct }: { pred: string | null; correct: boolean | null }) {
  if (!pred) return <span className="text-zinc-600 text-xs">—</span>

  const colorMap: Record<string, string> = {
    '1': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'X': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    '2': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  }

  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border', colorMap[pred])}>
      {pred}
      {correct === true && <span className="text-green-400">&#10003;</span>}
      {correct === false && <span className="text-red-400">&#10007;</span>}
    </span>
  )
}

export default async function CompararPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  // Fetch all members of the active porra for the selector
  const { data: membersRaw } = await (supabase as any)
    .from('leaderboard')
    .select('user_id, display_name, avatar_url')
    .eq('porra_id', porraId)
    .order('position', { ascending: true })

  const allUsers: { user_id: string; display_name: string; avatar_url: string | null }[] = membersRaw ?? []

  const { a, b } = await searchParams

  // No params: show selector
  if (!a || !b) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Comparar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Head-to-head entre dos participantes de la porra.</p>
        </div>
        <CompararForm users={allUsers} currentUserId={user.id} />
      </div>
    )
  }

  // Validate both IDs belong to this porra
  const userAData = allUsers.find(u => u.user_id === a)
  const userBData = allUsers.find(u => u.user_id === b)

  if (!userAData || !userBData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Comparar</h1>
        </div>
        <div className="bg-[#13151c] border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-400 text-sm font-medium">Uno o ambos usuarios no pertenecen a esta porra.</p>
          <a href="/comparar" className="mt-3 inline-block text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
            Volver al selector
          </a>
        </div>
      </div>
    )
  }

  if (a === b) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Comparar</h1>
        </div>
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-6 text-center">
          <p className="text-zinc-400 text-sm">No puedes comparar un jugador consigo mismo.</p>
          <a href="/comparar" className="mt-3 inline-block text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2">
            Volver al selector
          </a>
        </div>
      </div>
    )
  }

  // Fetch scores
  const [{ data: scoreA }, { data: scoreB }] = await Promise.all([
    (supabase as any).from('scores').select('*').eq('porra_id', porraId).eq('user_id', a).maybeSingle(),
    (supabase as any).from('scores').select('*').eq('porra_id', porraId).eq('user_id', b).maybeSingle(),
  ])

  // Fetch played matches with teams
  const { data: matchesRaw } = await (supabase as any)
    .from('matches')
    .select(`
      id, phase, match_number, group_letter, kickoff_at, result_ft,
      home_goals_ft, away_goals_ft,
      home_team:teams!matches_home_team_id_fkey(name, short_code),
      away_team:teams!matches_away_team_id_fkey(name, short_code)
    `)
    .not('result_ft', 'is', null)
    .order('kickoff_at', { ascending: true })

  const playedMatches: any[] = matchesRaw ?? []
  const matchIds = playedMatches.map((m: any) => m.id)

  // Fetch predictions for both users in this porra
  const [{ data: predsA }, { data: predsB }] = await Promise.all([
    matchIds.length > 0
      ? (supabase as any)
          .from('predictions')
          .select('match_id, prediction, is_correct, points_awarded')
          .eq('porra_id', porraId)
          .eq('user_id', a)
          .in('match_id', matchIds)
      : { data: [] },
    matchIds.length > 0
      ? (supabase as any)
          .from('predictions')
          .select('match_id, prediction, is_correct, points_awarded')
          .eq('porra_id', porraId)
          .eq('user_id', b)
          .in('match_id', matchIds)
      : { data: [] },
  ])

  const predMapA = Object.fromEntries((predsA ?? []).map((p: any) => [p.match_id, p]))
  const predMapB = Object.fromEntries((predsB ?? []).map((p: any) => [p.match_id, p]))

  // Filter: only show matches where at least one has a prediction
  const relevantMatches = playedMatches.filter(
    (m: any) => predMapA[m.id] || predMapB[m.id]
  )

  // Summary counters
  let correctA = 0
  let correctB = 0
  let bothCorrect = 0
  for (const m of relevantMatches) {
    const pA = predMapA[m.id]
    const pB = predMapB[m.id]
    const aOk = pA?.is_correct === true
    const bOk = pB?.is_correct === true
    if (aOk) correctA++
    if (bOk) correctB++
    if (aOk && bOk) bothCorrect++
  }

  const totalA = scoreA?.total_points ?? 0
  const totalB = scoreB?.total_points ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Comparar</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Head-to-head entre dos participantes.</p>
        </div>
        <a
          href="/comparar"
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-2"
        >
          Cambiar seleccion
        </a>
      </div>

      {/* User cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { userData: userAData, score: scoreA, side: 'A', winning: totalA > totalB, tied: totalA === totalB },
          { userData: userBData, score: scoreB, side: 'B', winning: totalB > totalA, tied: totalA === totalB },
        ].map(({ userData, score, side, winning, tied }) => (
          <div
            key={side}
            className={clsx(
              'bg-[#13151c] border rounded-xl p-4 flex flex-col items-center text-center gap-2',
              winning ? 'border-blue-500/40' : 'border-[#1f2333]'
            )}
          >
            <Avatar name={userData.display_name} avatarUrl={userData.avatar_url} size="lg" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{userData.display_name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">Jugador {side}</p>
            </div>
            <div className={clsx('text-3xl font-bold tabular-nums', winning ? 'text-blue-400' : tied ? 'text-white' : 'text-zinc-400')}>
              {score?.total_points ?? 0}
            </div>
            <p className="text-[11px] text-zinc-600">puntos totales</p>
            <div className="w-full border-t border-[#1f2333] pt-2 mt-1 grid grid-cols-2 gap-1 text-center">
              <div>
                <p className="text-xs text-zinc-400 font-medium">{score?.total_points_groups ?? 0}</p>
                <p className="text-[10px] text-zinc-600">Grupos</p>
              </div>
              <div>
                <p className="text-xs text-zinc-400 font-medium">{score?.total_points_playoffs ?? 0}</p>
                <p className="text-[10px] text-zinc-600">Playoffs</p>
              </div>
            </div>
            {winning && (
              <span className="text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                Va ganando
              </span>
            )}
            {tied && !winning && (
              <span className="text-[10px] font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/20 px-2 py-0.5 rounded-full">
                Empate
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      {relevantMatches.length > 0 && (
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl px-5 py-4">
          <h2 className="text-sm font-semibold text-white mb-3">Resumen de partidos jugados</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className={clsx('text-2xl font-bold tabular-nums', correctA > correctB ? 'text-blue-400' : 'text-white')}>{correctA}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Aciertos {userAData.display_name.split(' ')[0]}</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-300">{bothCorrect}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Ambos acertaron</p>
            </div>
            <div>
              <p className={clsx('text-2xl font-bold tabular-nums', correctB > correctA ? 'text-blue-400' : 'text-white')}>{correctB}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Aciertos {userBData.display_name.split(' ')[0]}</p>
            </div>
          </div>
        </div>
      )}

      {/* Match-by-match comparison */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f2333]">
          <h2 className="text-base font-semibold text-white">Partido a partido</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Solo partidos ya jugados donde alguno hizo prediccion.</p>
        </div>

        {relevantMatches.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-sm">
            Todavia no hay partidos jugados con predicciones de estos usuarios.
          </div>
        ) : (
          <div className="divide-y divide-[#1f2333]">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-2 bg-[#0c0d12]/50">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide text-right">
                {userAData.display_name.split(' ')[0]}
              </div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide text-center min-w-[120px]">
                Partido
              </div>
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide text-left">
                {userBData.display_name.split(' ')[0]}
              </div>
            </div>

            {relevantMatches.map((match: any) => {
              const pA = predMapA[match.id]
              const pB = predMapB[match.id]
              const homeTeam = match.home_team?.short_code ?? match.home_team?.name ?? '?'
              const awayTeam = match.away_team?.short_code ?? match.away_team?.name ?? '?'
              const scoreStr = match.home_goals_ft !== null
                ? `${match.home_goals_ft}-${match.away_goals_ft}`
                : ''
              const phase = PHASE_LABELS[match.phase] ?? match.phase
              const label = match.phase === 'group' && match.group_letter
                ? `Grupo ${match.group_letter}`
                : phase

              return (
                <div
                  key={match.id}
                  className="grid grid-cols-[1fr_auto_1fr] gap-2 px-4 py-3 items-center hover:bg-[#191c26] transition-colors"
                >
                  {/* Pred A */}
                  <div className="flex justify-end">
                    <PredBadge pred={pA?.prediction ?? null} correct={pA?.is_correct ?? null} />
                  </div>

                  {/* Match info */}
                  <div className="text-center min-w-[120px] sm:min-w-[160px]">
                    <p className="text-xs text-zinc-300 font-medium leading-tight">
                      {homeTeam} - {awayTeam}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">{scoreStr} &middot; {label}</p>
                  </div>

                  {/* Pred B */}
                  <div className="flex justify-start">
                    <PredBadge pred={pB?.prediction ?? null} correct={pB?.is_correct ?? null} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
