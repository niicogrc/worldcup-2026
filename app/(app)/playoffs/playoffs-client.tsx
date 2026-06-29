'use client'

import React, { useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Database, MatchResult, TournamentPhase } from '@/lib/supabase/types'
import { getFlagUrl } from '@/lib/flags'
import { Check, ChevronRight, ChevronDown, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { useMemberView, PorraMember } from '@/lib/hooks/use-member-view'
import MemberViewBar from '@/components/porra/member-view-bar'
import { BRACKET_SOURCES, THIRD_PLACE_SOURCES, NEXT_MATCH } from '@/lib/playoffs/bracket'

type TeamRef = { id: string; name: string; flag_url: string | null; short_code: string | null }
type MatchWithTeams = Database['public']['Tables']['matches']['Row'] & {
  home_team: TeamRef | null
  away_team: TeamRef | null
}
type PredictionRow = Database['public']['Tables']['predictions']['Row']
type AdvanceSide = '1' | '2'
/** Equipo resuelto en un hueco del cuadro (real o derivado de la cascada). */
type ResolvedTeam = { id: string | null; name: string; short_code: string | null } | null

interface PlayoffsClientProps {
  initialMatches: MatchWithTeams[]
  initialPredictions: PredictionRow[]
  porraId: string
  members: PorraMember[]
  currentUserId: string
}

const ROUND_TEXT: Partial<Record<TournamentPhase, string>> = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  final: 'Final',
}

// Rondas en orden, para los tabs y el botón "siguiente".
const ROUNDS: { phase: TournamentPhase; label: string; short: string }[] = [
  { phase: 'round_of_32', label: 'Dieciseisavos', short: '16avos' },
  { phase: 'round_of_16', label: 'Octavos', short: 'Octavos' },
  { phase: 'quarter_final', label: 'Cuartos', short: 'Cuartos' },
  { phase: 'semi_final', label: 'Semifinales', short: 'Semis' },
  { phase: 'final', label: 'Final', short: 'Final' },
  { phase: 'third_place', label: '3.er y 4.º puesto', short: '3.º' },
]

const FINISHED = ['FT', 'AET', 'PEN']
const LIVE = ['1H', 'HT', '2H', 'ET', 'P']

function teamFromRef(t: TeamRef | null): ResolvedTeam {
  return t ? { id: t.id, name: t.name, short_code: t.short_code } : null
}

function withKey<T>(obj: Record<string, T>, key: string, val: T | undefined): Record<string, T> {
  const n = { ...obj }
  if (val === undefined) delete n[key]
  else n[key] = val
  return n
}

/** Lado que el usuario marcó como ganador (explícito o derivado de la predicción). */
function sideOf(predictions: Record<string, MatchResult>, advanceSides: Record<string, AdvanceSide>, id: string): AdvanceSide | null {
  const adv = advanceSides[id]
  if (adv) return adv
  const pred = predictions[id]
  return pred === '1' ? '1' : pred === '2' ? '2' : null
}

/**
 * Construye un resolutor de la cascada del cuadro a partir de las picks dadas.
 * Para cada hueco devuelve el equipo que lo ocupa: el real si ya se conoce,
 * o el ganador predicho del cruce anterior (recursivo). Memoiza por render.
 */
function buildResolver(
  byNumber: Record<number, MatchWithTeams>,
  predictions: Record<string, MatchResult>,
  advanceSides: Record<string, AdvanceSide>,
) {
  const advancerCache = new Map<number, ResolvedTeam>()

  function slot(n: number, side: 'home' | 'away'): ResolvedTeam {
    const m = byNumber[n]
    if (!m) return null
    // La realidad manda: si el hueco ya tiene equipo asignado en la DB, ese.
    const dbTeam = side === 'home' ? m.home_team : m.away_team
    if (dbTeam) return teamFromRef(dbTeam)
    if (m.phase === 'round_of_32') return null // sin equipo aún → TBD
    if (m.phase === 'third_place') {
      return loser(side === 'home' ? THIRD_PLACE_SOURCES.home : THIRD_PLACE_SOURCES.away)
    }
    const src = BRACKET_SOURCES[m.match_number ?? -1]
    if (!src) return null
    return advancer(side === 'home' ? src.home : src.away)
  }

  /** Equipo que AVANZA del cruce n según la cascada (o el resultado real). */
  function advancer(n: number): ResolvedTeam {
    if (advancerCache.has(n)) return advancerCache.get(n)!
    advancerCache.set(n, null) // guard anti-ciclos
    const m = byNumber[n]
    let result: ResolvedTeam = null
    if (m) {
      const home = slot(n, 'home')
      const away = slot(n, 'away')
      if (FINISHED.includes(m.status)) {
        // Avance real: ganador a 90'; si X, penaltis (si están en la DB).
        if (m.result_ft === '1') result = home
        else if (m.result_ft === '2') result = away
        else if (m.result_ft === 'X') {
          if (m.home_goals_pen != null && m.away_goals_pen != null) {
            result = m.home_goals_pen >= m.away_goals_pen ? home : away
          } else {
            const side = advanceSides[m.id]
            result = side === '1' ? home : side === '2' ? away : null
          }
        }
      } else {
        // Sin jugar: manda la pick del usuario (quién pasa).
        const side = advanceSides[m.id]
        if (side === '1') result = home
        else if (side === '2') result = away
        else {
          const pred = predictions[m.id]
          if (pred === '1') result = home
          else if (pred === '2') result = away
        }
      }
    }
    advancerCache.set(n, result)
    return result
  }

  /** Equipo que CAE en el cruce n (el lado que no avanza). */
  function loser(n: number): ResolvedTeam {
    const m = byNumber[n]
    if (!m) return null
    const adv = advancer(n)
    if (!adv) return null
    const home = slot(n, 'home')
    const away = slot(n, 'away')
    if (home && adv.name === home.name) return away
    if (away && adv.name === away.name) return home
    return null
  }

  return { slot, advancer, loser }
}

// ───────────────────────── Card de cruce (lista por ronda) ─────────────────────────

interface MatchCardProps {
  match: MatchWithTeams
  home: ResolvedTeam
  away: ResolvedTeam
  predictedSide: AdvanceSide | null
  finished: boolean
  live: boolean
  interactive: boolean
  saving: boolean
  note: string | null
  onPick: (side: AdvanceSide) => void
}

function MatchCard({ match, home, away, predictedSide, finished, live, interactive, saving, note, onPick }: MatchCardProps) {
  const correct = finished && predictedSide != null ? predictedSide === match.result_ft : null
  const rows: { side: AdvanceSide; team: ResolvedTeam; score: number | null; isWinner: boolean }[] = [
    { side: '1', team: home, score: match.home_goals_ft, isWinner: finished && match.result_ft === '1' },
    { side: '2', team: away, score: match.away_goals_ft, isWinner: finished && match.result_ft === '2' },
  ]

  return (
    <div className={clsx(
      'rounded-xl border bg-[#13151c] overflow-hidden transition-colors',
      predictedSide ? 'border-blue-500/30' : 'border-[#1f2333]'
    )}>
      <div className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5 text-[11px] text-zinc-500">
        <span className="tabular-nums">Partido {match.match_number}</span>
        {live ? (
          <span className="text-amber-400 font-medium animate-pulse">● En juego</span>
        ) : finished ? (
          <span className="text-zinc-500">Finalizado</span>
        ) : (
          <span>{new Date(match.kickoff_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>

      <div className="divide-y divide-[#1f2333]">
        {rows.map(({ side, team, score, isWinner }) => {
          const name = team?.name || 'Por clasificar'
          const flag = team ? getFlagUrl(name) : null
          const selected = predictedSide === side
          const RowTag = (interactive ? 'button' : 'div') as React.ElementType
          return (
            <RowTag
              key={side}
              {...(interactive ? { type: 'button', disabled: saving || !team, onClick: () => onPick(side) } : {})}
              className={clsx(
                'w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors',
                interactive && 'cursor-pointer disabled:cursor-not-allowed',
                selected ? 'bg-blue-500/10' : interactive ? 'hover:bg-[#191c26]' : ''
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {flag ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={flag} alt={name} className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                ) : (
                  <span className="w-6 h-4 rounded-sm bg-[#1f2333] flex-shrink-0" />
                )}
                <span className={clsx(
                  'truncate text-sm',
                  selected ? 'text-blue-300 font-semibold' : isWinner ? 'text-white font-semibold' : 'text-zinc-300'
                )}>
                  {name}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {finished ? (
                  <span className={clsx('text-sm font-bold tabular-nums', isWinner ? 'text-white' : 'text-zinc-500')}>
                    {score ?? '–'}
                  </span>
                ) : (
                  <span className={clsx(
                    'text-[11px] font-semibold px-2 py-1 rounded-md border flex items-center gap-1',
                    selected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : interactive ? 'border-[#2a2f42] text-zinc-400' : 'border-[#1f2333] text-zinc-600'
                  )}>
                    {selected && <Check className="w-3 h-3" />}
                    Pasa
                  </span>
                )}
              </div>
            </RowTag>
          )
        })}
      </div>

      {(note || correct != null) && (
        <div className="px-3.5 py-2 border-t border-[#1f2333] text-[11px] flex items-center gap-1.5">
          {correct != null && (
            <span className={clsx('font-medium', correct ? 'text-green-400' : 'text-red-400')}>
              {correct ? '✓ Acertaste' : '✗ Fallaste'}
            </span>
          )}
          {note && <span className="text-zinc-500">{note}</span>}
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────── Página ─────────────────────────────────────

export default function PlayoffsClient({ initialMatches, initialPredictions, porraId, members, currentUserId }: PlayoffsClientProps) {
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [advanceSides, setAdvanceSides] = useState<Record<string, AdvanceSide>>(
    initialPredictions.reduce((acc, p) => (p.advance_side ? { ...acc, [p.match_id]: p.advance_side as AdvanceSide } : acc), {})
  )
  const [activeRound, setActiveRound] = useState<TournamentPhase>('round_of_32')
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null)
  const [showBracket, setShowBracket] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    viewingUserId, isViewingOther, viewedMember, viewedPredictions, viewedAdvanceSides,
    loadingMemberId, viewError, viewMember,
  } = useMemberView(porraId, currentUserId, members)

  const shownPredictions = isViewingOther ? viewedPredictions : predictions
  const shownAdvanceSides = (isViewingOther ? viewedAdvanceSides : advanceSides) as Record<string, AdvanceSide>

  const byNumber: Record<number, MatchWithTeams> = {}
  for (const m of initialMatches) if (m.match_number != null) byNumber[m.match_number] = m

  const resolver = buildResolver(byNumber, shownPredictions, shownAdvanceSides)
  const now = new Date()

  const pickAdvancer = async (m: MatchWithTeams, side: AdvanceSide) => {
    if (savingMatchId) return
    const prevPred = predictions[m.id]
    const prevAdv = advanceSides[m.id]
    // Optimista: pinta ya la pick y deja que la cascada se recalcule.
    setPredictions((p) => withKey(p, m.id, side))
    setAdvanceSides((a) => withKey(a, m.id, side))
    setSavingMatchId(m.id)
    setError(null)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: m.id, prediction: side, advanceSide: side, porraId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (err: unknown) {
      setPredictions((p) => withKey(p, m.id, prevPred))
      setAdvanceSides((a) => withKey(a, m.id, prevAdv))
      setError(err instanceof Error ? err.message : 'Error guardando la predicción')
    } finally {
      setSavingMatchId(null)
    }
  }

  // Partidos de la ronda activa, ordenados por número.
  const roundMatches = initialMatches
    .filter((m) => m.phase === activeRound)
    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0))

  const roundIndex = ROUNDS.findIndex((r) => r.phase === activeRound)
  const nextRound = ROUNDS[roundIndex + 1]
  const predictedInRound = roundMatches.filter((m) => predictions[m.id]).length

  // ── Overview (árbol de solo lectura) ──
  const treeMatches = initialMatches
    .filter((m) => m.phase !== 'third_place' && m.phase !== 'group')
    .sort((a, b) => (a.match_number || 0) - (b.match_number || 0))

  const mappedMatches = treeMatches.map((m) => {
    const num = m.match_number!
    const home = resolver.slot(num, 'home')
    const away = resolver.slot(num, 'away')
    const isFinished = FINISHED.includes(m.status)
    const isLive = LIVE.includes(m.status)
    const nextNum = NEXT_MATCH[num]
    return {
      id: String(num),
      name: `M${num}`,
      nextMatchId: nextNum ? String(nextNum) : null,
      tournamentRoundText: ROUND_TEXT[m.phase] ?? '',
      state: isFinished ? 'DONE' : isLive ? 'LIVE' : 'SCHEDULED',
      dbMatch: m,
      participants: [
        { id: home?.id || `${num}-home`, name: home?.name || 'Por clasificar', resultText: isFinished ? String(m.home_goals_ft ?? '') : null, isWinner: isFinished && m.result_ft === '1' },
        { id: away?.id || `${num}-away`, name: away?.name || 'Por clasificar', resultText: isFinished ? String(m.away_goals_ft ?? '') : null, isWinner: isFinished && m.result_ft === '2' },
      ],
    }
  })

  const OverviewNode = ({ match, onMatchClick }: any) => {
    const dbMatch = match.dbMatch as MatchWithTeams
    if (!dbMatch) return null
    const side = sideOf(shownPredictions, shownAdvanceSides, dbMatch.id)
    const isFinished = FINISHED.includes(dbMatch.status)
    return (
      <div
        onClick={() => onMatchClick(dbMatch)}
        className={clsx(
          'w-full h-full p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 bg-[#13151c]',
          side ? 'border-blue-500/30' : 'border-[#1f2333] hover:border-[#2a2f42]'
        )}
      >
        <div className="flex justify-between items-center text-[9px] text-zinc-500 border-b border-[#1f2333] pb-1.5 mb-1.5">
          <span>M{dbMatch.match_number}</span>
          {isFinished ? <span className="text-zinc-600">FT</span> : <span>{new Date(dbMatch.kickoff_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>}
        </div>
        <div className="space-y-1">
          {[0, 1].map((i) => {
            const teamName = match.participants[i].name
            const flagUrl = getFlagUrl(teamName)
            const rowSide: AdvanceSide = i === 0 ? '1' : '2'
            return (
              <div key={i} className="flex justify-between items-center gap-1 text-xs">
                <div className="flex items-center gap-1 min-w-0">
                  {flagUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flagUrl} alt={teamName} className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                  )}
                  <span className={clsx('truncate', !isFinished && side === rowSide ? 'text-blue-400 font-semibold' : 'text-zinc-300', match.participants[i].isWinner ? 'text-white font-bold' : '')}>
                    {teamName}
                  </span>
                </div>
                {isFinished && <span className="text-white font-bold tabular-nums">{match.participants[i].resultText}</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const jumpToRound = (m: MatchWithTeams) => {
    setActiveRound(m.phase)
    setShowBracket(false)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5">
      <MemberViewBar
        members={members}
        currentUserId={currentUserId}
        viewingUserId={viewingUserId}
        loadingMemberId={loadingMemberId}
        onView={viewMember}
      />

      {viewError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{viewError}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {!isViewingOther && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          Toca el equipo que crees que pasa en cada cruce. Se rellenará la siguiente ronda automáticamente, así puedes predecir todo el cuadro de una vez.
        </p>
      )}

      {/* Tabs de ronda (sticky) */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-[#0c0d12]/95 backdrop-blur border-b border-[#1f2333]">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {ROUNDS.map((r) => {
            const count = initialMatches.filter((m) => m.phase === r.phase).length
            const done = initialMatches.filter((m) => m.phase === r.phase && predictions[m.id]).length
            const active = r.phase === activeRound
            return (
              <button
                key={r.phase}
                onClick={() => setActiveRound(r.phase)}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5',
                  active ? 'bg-blue-500 text-white' : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-[#2a2f42]'
                )}
              >
                {r.short}
                {!isViewingOther && (
                  <span className={clsx('text-[10px] tabular-nums', active ? 'text-blue-100' : done === count ? 'text-green-400' : 'text-zinc-600')}>
                    {done}/{count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progreso de la ronda activa */}
      {!isViewingOther && roundMatches.length > 1 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-[#1f2333] overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${(predictedInRound / roundMatches.length) * 100}%` }} />
          </div>
          <span className="text-[11px] text-zinc-500 tabular-nums">{predictedInRound}/{roundMatches.length} predichos</span>
        </div>
      )}

      {/* Lista de cruces de la ronda */}
      <div className="space-y-2.5">
        {roundMatches.map((m) => {
          const num = m.match_number!
          const home = resolver.slot(num, 'home')
          const away = resolver.slot(num, 'away')
          const finished = FINISHED.includes(m.status)
          const live = LIVE.includes(m.status)
          const locked = new Date(m.kickoff_at) <= now
          const bothKnown = !!home && !!away
          const predictedSide = sideOf(shownPredictions, shownAdvanceSides, m.id)

          let interactive = false
          let note: string | null = null
          if (isViewingOther) {
            if (!locked) note = `Predicción de ${viewedMember?.display_name ?? 'este miembro'} oculta hasta el kick-off`
            else if (!predictedSide && !finished) note = `${viewedMember?.display_name ?? 'No'} no hizo predicción`
          } else if (finished || locked) {
            interactive = false
            if (!finished && !predictedSide) note = 'Cerrado'
          } else if (!bothKnown) {
            note = 'Completa la ronda anterior para ver el cruce'
          } else {
            interactive = true
          }

          return (
            <MatchCard
              key={m.id}
              match={m}
              home={home}
              away={away}
              predictedSide={predictedSide}
              finished={finished}
              live={live}
              interactive={interactive}
              saving={savingMatchId === m.id}
              note={note}
              onPick={(side) => pickAdvancer(m, side)}
            />
          )
        })}
      </div>

      {/* Siguiente ronda */}
      {nextRound && (
        <button
          onClick={() => { setActiveRound(nextRound.phase); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-[#1f2333] bg-[#13151c] text-sm font-medium text-zinc-300 hover:border-blue-500/30 hover:text-white transition-colors cursor-pointer"
        >
          Siguiente: {nextRound.label}
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Overview: cuadro completo (solo lectura, colapsable) */}
      <div className="pt-1">
        <button
          onClick={() => setShowBracket((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ChevronDown className={clsx('w-4 h-4 transition-transform', showBracket && 'rotate-180')} />
          {showBracket ? 'Ocultar cuadro completo' : 'Ver cuadro completo'}
        </button>

        {showBracket && (
          <div className="mt-3 bg-[#13151c] border border-[#1f2333] rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-3">Vista general. Toca un partido para ir a su ronda y editarlo.</p>
            {mappedMatches.length > 0 ? (
              <div className="overflow-x-auto">
                <SingleEliminationBracket
                  matches={mappedMatches}
                  matchComponent={(props: any) => <OverviewNode {...props} onMatchClick={jumpToRound} />}
                  svgWrapper={({ children, ...props }: any) => (
                    <SVGViewer width={1000} height={600} {...props}>{children}</SVGViewer>
                  )}
                  options={{ style: { roundHeader: { backgroundColor: 'transparent', fontColor: '#52525b' }, connectorColor: '#1f2333', connectorColorHighlight: '#3b82f6' } }}
                />
              </div>
            ) : (
              <p className="text-center text-zinc-500 py-8 text-sm">Aún no hay partidos en el cuadro.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
