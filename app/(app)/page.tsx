import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { getActivePorraId } from '@/lib/active-porra'
import { Calendar, GitMerge, Award, BarChart2, User, Clock, Zap, Trophy } from 'lucide-react'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

const TOURNAMENT_START = new Date('2026-06-11T19:00:00Z')
const TOURNAMENT_END = new Date('2026-07-19T21:00:00Z')

function getTournamentStatus(now: Date) {
  if (now < TOURNAMENT_START) {
    const daysLeft = Math.ceil((TOURNAMENT_START.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      type: 'pre' as const,
      message: `Quedan ${daysLeft} día${daysLeft !== 1 ? 's' : ''} para el Mundial`,
    }
  }
  if (now <= TOURNAMENT_END) {
    const dayNumber = Math.min(Math.ceil((now.getTime() - TOURNAMENT_START.getTime()) / (1000 * 60 * 60 * 24)), 39)
    return {
      type: 'live' as const,
      message: `El Mundial está en marcha · Día ${dayNumber} de 39`,
    }
  }
  return {
    type: 'ended' as const,
    message: 'El Mundial ha terminado',
  }
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  const [rankRes, matchesRes, predsRes, goldenBootRes] = await Promise.all([
    (supabase as any).from('leaderboard').select('position, total_points, display_name').eq('porra_id', porraId).eq('user_id', user.id).maybeSingle(),
    supabase.from('matches').select('id, phase, home_team_id'),
    (supabase as any).from('predictions').select('match_id').eq('porra_id', porraId).eq('user_id', user.id),
    (supabase as any).from('golden_boot_predictions').select('player_name').eq('porra_id', porraId).eq('user_id', user.id).maybeSingle(),
  ])

  const myRank = rankRes.data as any
  const allMatches = (matchesRes.data as any[]) ?? []
  const userPredictions = (predsRes.data as any[]) ?? []
  const goldenBootPred = goldenBootRes.data as any

  const predSet = new Set(userPredictions.map((p: any) => p.match_id))
  const groupMatches = allMatches.filter((m: any) => m.phase === 'group')
  const playoffMatches = allMatches.filter((m: any) => m.phase !== 'group' && m.home_team_id)
  const groupPredCount = groupMatches.filter((m: any) => predSet.has(m.id)).length
  const playoffPredCount = playoffMatches.filter((m: any) => predSet.has(m.id)).length
  const playoffTotal = playoffMatches.length

  const displayName = myRank?.display_name ?? user.email?.split('@')[0] ?? 'Usuario'
  const firstName = displayName.split(' ')[0]
  const status = getTournamentStatus(new Date())

  const statusConfig = {
    pre:   { icon: Clock,   bg: 'bg-blue-500/10',  border: 'border-blue-500/20',  text: 'text-blue-400',  dot: null },
    live:  { icon: Zap,    bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', dot: true },
    ended: { icon: Trophy, bg: 'bg-zinc-500/10',  border: 'border-zinc-500/20',  text: 'text-zinc-400',  dot: null },
  }[status.type]

  const StatusIcon = statusConfig.icon

  const actions = [
    {
      href: '/grupos',
      icon: Calendar,
      label: 'Fase de Grupos',
      description: 'Predice los 72 partidos de la fase de grupos',
      accent: 'blue',
      progress: `${groupPredCount} / 72 predicciones`,
      progressRatio: groupPredCount / 72,
    },
    {
      href: '/playoffs',
      icon: GitMerge,
      label: 'Playoffs',
      description: 'Bracket de eliminatorias del Mundial',
      accent: 'violet',
      progress: playoffTotal > 0 ? `${playoffPredCount} / ${playoffTotal} disponibles` : 'Disponible al terminar grupos',
      progressRatio: playoffTotal > 0 ? playoffPredCount / playoffTotal : 0,
    },
    {
      href: '/bota-de-oro',
      icon: Award,
      label: 'Bota de Oro',
      description: '¿Quién será el máximo goleador?',
      accent: 'amber',
      progress: goldenBootPred?.player_name ? goldenBootPred.player_name : 'Sin predicción',
      progressRatio: goldenBootPred ? 1 : 0,
    },
    {
      href: '/dashboard',
      icon: BarChart2,
      label: 'Leaderboard',
      description: 'Clasificación general en tiempo real',
      accent: 'emerald',
      progress: myRank ? `#${myRank.position} en el ranking` : 'Sin posición aún',
      progressRatio: null,
    },
  ]

  const accentClasses: Record<string, { icon: string; bar: string; pill: string }> = {
    blue:    { icon: 'text-blue-400',   bar: 'bg-blue-500',   pill: 'bg-blue-500/10 text-blue-400' },
    violet:  { icon: 'text-violet-400', bar: 'bg-violet-500', pill: 'bg-violet-500/10 text-violet-400' },
    amber:   { icon: 'text-amber-400',  bar: 'bg-amber-500',  pill: 'bg-amber-500/10 text-amber-400' },
    emerald: { icon: 'text-emerald-400',bar: 'bg-emerald-500',pill: 'bg-emerald-500/10 text-emerald-400' },
  }

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Welcome */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-white">
          Bienvenido, <span className="text-blue-400">{firstName}</span> ⚽
        </h1>

        <div className={clsx(
          'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium',
          statusConfig.bg, statusConfig.border, statusConfig.text
        )}>
          {statusConfig.dot && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          )}
          {!statusConfig.dot && <StatusIcon className="w-4 h-4" />}
          {status.message}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Tu posición</p>
          <p className="text-3xl font-bold text-blue-400 tabular-nums">
            {myRank ? `#${myRank.position}` : '—'}
          </p>
          <p className="text-xs text-zinc-600 mt-1">en el ranking</p>
        </div>
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-4">
          <p className="text-xs text-zinc-500 mb-1">Puntos totales</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {myRank?.total_points ?? 0}
          </p>
          <p className="text-xs text-zinc-600 mt-1">de 371 posibles</p>
        </div>
      </div>

      {/* Actions */}
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">¿Qué quieres hacer?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon
            const ac = accentClasses[action.accent]
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group bg-[#13151c] hover:bg-[#191c26] border border-[#1f2333] hover:border-[#2a2f42] rounded-xl p-5 transition-all duration-200 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className={clsx('p-2 rounded-lg bg-[#0c0d12]', ac.icon)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={clsx('text-[11px] font-medium px-2 py-0.5 rounded-full', ac.pill)}>
                    {action.progress}
                  </span>
                </div>

                <div>
                  <p className="text-white font-semibold text-sm group-hover:text-white transition-colors">
                    {action.label}
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{action.description}</p>
                </div>

                {action.progressRatio !== null && (
                  <div className="w-full bg-[#1f2333] rounded-full h-1">
                    <div
                      className={clsx('h-1 rounded-full transition-all', ac.bar)}
                      style={{ width: `${Math.min(action.progressRatio * 100, 100)}%` }}
                    />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Profile */}
      <Link
        href="/perfil"
        className="flex items-center gap-3 px-4 py-3 bg-[#13151c] hover:bg-[#191c26] border border-[#1f2333] hover:border-[#2a2f42] rounded-xl transition-all duration-200 group"
      >
        <div className="p-1.5 rounded-lg bg-[#0c0d12] text-zinc-400">
          <User className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">Mi perfil</p>
          <p className="text-xs text-zinc-600">Edita tu nombre y avatar</p>
        </div>
        <span className="text-zinc-600 group-hover:text-zinc-400 transition-colors text-sm">→</span>
      </Link>

    </div>
  )
}
