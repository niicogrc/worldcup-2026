'use client'

import React, { useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Database, MatchResult, TournamentPhase } from '@/lib/supabase/types'
import { getFlagUrl } from '@/lib/flags'
import { X, AlertCircle, Lock, Check } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'
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

const PHASE_NAMES: Record<TournamentPhase, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos de Final',
  quarter_final: 'Cuartos de Final',
  semi_final: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Gran Final',
}

const ROUND_TEXT: Partial<Record<TournamentPhase, string>> = {
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semifinales',
  final: 'Final',
}

const FINISHED = ['FT', 'AET', 'PEN']
const LIVE = ['1H', 'HT', '2H', 'ET', 'P']

function teamFromRef(t: TeamRef | null): ResolvedTeam {
  return t ? { id: t.id, name: t.name, short_code: t.short_code } : null
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
          // Sin advance_side guardado: derivar de 1/2 (X queda indefinido).
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

/** Botón para elegir qué equipo pasa. Declarado fuera del render (no recrear en cada render). */
function TeamPickButton({ team, selected, disabled, onPick }: {
  team: ResolvedTeam
  selected: boolean
  disabled: boolean
  onPick: () => void
}) {
  const name = team?.name || 'Por clasificar'
  const flag = team ? getFlagUrl(name) : null
  return (
    <button
      type="button"
      disabled={disabled || !team}
      onClick={onPick}
      className={clsx(
        'flex-1 py-4 px-3 rounded-lg border text-sm font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center gap-2',
        selected
          ? 'bg-blue-500 border-blue-500 text-white shadow-sm shadow-blue-500/30'
          : 'bg-[#0c0d12] border-[#1f2333] text-zinc-300 hover:border-blue-500/30 hover:text-white'
      )}
    >
      {flag && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flag} alt={name} className="w-8 h-5 object-cover rounded-sm" />
      )}
      <span className="text-center leading-tight">{name}</span>
      <span className={clsx('text-[10px]', selected ? 'opacity-90' : 'opacity-60')}>
        {selected ? 'Pasa ✓' : 'Pasa'}
      </span>
    </button>
  )
}

export default function PlayoffsClient({ initialMatches, initialPredictions, porraId, members, currentUserId }: PlayoffsClientProps) {
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [advanceSides, setAdvanceSides] = useState<Record<string, AdvanceSide>>(
    initialPredictions.reduce((acc, p) => (p.advance_side ? { ...acc, [p.match_id]: p.advance_side as AdvanceSide } : acc), {})
  )
  const [activePredictMatch, setActivePredictMatch] = useState<MatchWithTeams | null>(null)
  // Estado del modal: lado que avanza + si fue empate a 90' (penaltis)
  const [modalSide, setModalSide] = useState<AdvanceSide | null>(null)
  const [modalDraw, setModalDraw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ver predicciones de otro miembro de la porra (solo lectura)
  const {
    viewingUserId, isViewingOther, viewedMember, viewedPredictions, viewedAdvanceSides,
    loadingMemberId, viewError, viewMember,
  } = useMemberView(porraId, currentUserId, members)

  const shownPredictions = isViewingOther ? viewedPredictions : predictions
  const shownAdvanceSides = (isViewingOther ? viewedAdvanceSides : advanceSides) as Record<string, AdvanceSide>

  const byNumber: Record<number, MatchWithTeams> = {}
  for (const m of initialMatches) if (m.match_number != null) byNumber[m.match_number] = m

  const resolver = buildResolver(byNumber, shownPredictions, shownAdvanceSides)

  const thirdPlaceMatch = initialMatches.find((m) => m.phase === 'third_place') || null

  // Nodos del árbol (todo menos el 3er puesto), ordenados por número de partido.
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
      resolvedHome: home,
      resolvedAway: away,
      participants: [
        {
          id: home?.id || `${num}-home`,
          name: home?.name || 'Por clasificar',
          resultText: isFinished ? String(m.home_goals_ft ?? '') : null,
          isWinner: isFinished && m.result_ft === '1',
        },
        {
          id: away?.id || `${num}-away`,
          name: away?.name || 'Por clasificar',
          resultText: isFinished ? String(m.away_goals_ft ?? '') : null,
          isWinner: isFinished && m.result_ft === '2',
        },
      ],
    }
  })

  // Abrir el modal precargando la pick actual del usuario.
  const openMatch = (m: MatchWithTeams) => {
    const pred = predictions[m.id]
    const adv = advanceSides[m.id]
    // lado que avanza: el guardado, o derivado de 1/2; X sin advance → null
    const side: AdvanceSide | null = adv ?? (pred === '1' ? '1' : pred === '2' ? '2' : null)
    setModalSide(side)
    setModalDraw(pred === 'X')
    setError(null)
    setActivePredictMatch(m)
  }

  const handlePredictSubmit = async () => {
    if (!activePredictMatch || !modalSide) return
    const prediction: MatchResult = modalDraw ? 'X' : modalSide
    const advanceSide = modalSide
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activePredictMatch.id, prediction, advanceSide, porraId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setPredictions((prev) => ({ ...prev, [activePredictMatch.id]: prediction }))
      setAdvanceSides((prev) => ({ ...prev, [activePredictMatch.id]: advanceSide }))
      setActivePredictMatch(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando predicción')
    } finally {
      setSaving(false)
    }
  }

  const CustomMatchNode = ({ match, onMatchClick }: any) => {
    const dbMatch = match.dbMatch as MatchWithTeams
    if (!dbMatch) return null
    const pred = shownPredictions[dbMatch.id]
    const advSide = shownAdvanceSides[dbMatch.id]
    const isFinished = FINISHED.includes(dbMatch.status)
    const isLive = LIVE.includes(dbMatch.status)
    const hasPick = !!pred

    return (
      <div
        onClick={() => onMatchClick(dbMatch)}
        className={clsx(
          'w-full h-full p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150 bg-[#13151c]',
          hasPick ? 'border-blue-500/30' : 'border-[#1f2333] hover:border-[#2a2f42]'
        )}
      >
        <div className="flex justify-between items-center text-[9px] text-zinc-500 border-b border-[#1f2333] pb-1.5 mb-1.5">
          <span>M{dbMatch.match_number}</span>
          {isLive ? (
            <span className="text-amber-400 font-medium animate-pulse">●</span>
          ) : isFinished ? (
            <span className="text-zinc-600">FT</span>
          ) : (
            <span>{new Date(dbMatch.kickoff_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
          )}
        </div>
        <div className="space-y-1">
          {[0, 1].map((i) => {
            const teamName = match.participants[i].name
            const flagUrl = getFlagUrl(teamName)
            const side: AdvanceSide = i === 0 ? '1' : '2'
            const isPredictedAdvancer = !isFinished && advSide === side
            return (
              <div key={i} className="flex justify-between items-center gap-1 text-xs">
                <div className="flex items-center gap-1 min-w-0">
                  {flagUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flagUrl} alt={teamName} className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                  )}
                  <span className={clsx(
                    'truncate',
                    isPredictedAdvancer ? 'text-blue-400 font-semibold' : 'text-zinc-300',
                    match.participants[i].isWinner ? 'text-white font-bold' : ''
                  )}>
                    {teamName}
                  </span>
                </div>
                {isFinished && <span className="text-white font-bold tabular-nums">{match.participants[i].resultText}</span>}
              </div>
            )
          })}
        </div>
        {hasPick && !isFinished && (
          <div className="mt-1.5 pt-1 border-t border-[#1f2333] text-[9px] flex justify-between">
            <span className="text-zinc-600">{pred === 'X' ? 'Empate 90′ + pen.' : 'Pasa'}</span>
            <span className="text-blue-400 font-semibold">
              {pred === 'X' ? 'X' : pred === '1' ? '1' : '2'}
            </span>
          </div>
        )}
      </div>
    )
  }

  // Datos del modal
  const activeNum = activePredictMatch?.match_number ?? null
  const modalHome = activeNum != null ? resolver.slot(activeNum, 'home') : null
  const modalAway = activeNum != null ? resolver.slot(activeNum, 'away') : null
  const isMatchLocked = activePredictMatch ? new Date(activePredictMatch.kickoff_at) <= new Date() : false
  const bothTeamsKnown = !!modalHome && !!modalAway

  // Resolver equipos del 3er puesto para su card
  const tpHome = thirdPlaceMatch?.match_number != null ? resolver.slot(thirdPlaceMatch.match_number, 'home') : null
  const tpAway = thirdPlaceMatch?.match_number != null ? resolver.slot(thirdPlaceMatch.match_number, 'away') : null

  return (
    <div className="space-y-6">
      <MemberViewBar
        members={members}
        currentUserId={currentUserId}
        viewingUserId={viewingUserId}
        loadingMemberId={loadingMemberId}
        onView={viewMember}
      />

      {viewError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {viewError}
        </div>
      )}

      {!isViewingOther && (
        <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/20 text-blue-300/90 rounded-lg text-xs leading-relaxed">
          Elige en cada cruce <strong>qué equipo pasa</strong> y se rellenará automáticamente la siguiente ronda — puedes predecir todo el cuadro de una vez.
          Si crees que será empate a 90′, márcalo: puntúa <strong>X</strong> pero el equipo que elijas seguirá avanzando (penaltis).
        </div>
      )}

      {/* Bracket */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bracket de eliminatorias</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-blue-500" /> Tu pick
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-[#1f2333] border border-[#2a2f42]" /> Sin predecir
            </span>
          </div>
        </div>

        {mappedMatches.length > 0 ? (
          <div className="overflow-x-auto">
            <SingleEliminationBracket
              matches={mappedMatches}
              matchComponent={(props: any) => (
                <CustomMatchNode {...props} onMatchClick={openMatch} />
              )}
              svgWrapper={({ children, ...props }: any) => (
                <SVGViewer width={1000} height={600} {...props}>
                  {children}
                </SVGViewer>
              )}
              options={{
                style: {
                  roundHeader: { backgroundColor: 'transparent', fontColor: '#52525b' },
                  connectorColor: '#1f2333',
                  connectorColorHighlight: '#3b82f6',
                },
              }}
            />
          </div>
        ) : (
          <p className="text-center text-zinc-500 py-12 text-sm">
            Aún no hay partidos en el bracket. Se cargarán cuando avance la fase de grupos.
          </p>
        )}
      </div>

      {/* Third place */}
      {thirdPlaceMatch && (
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 max-w-lg">
          <h2 className="text-sm font-semibold text-white mb-3">Tercer y Cuarto Puesto</h2>
          <div
            onClick={() => openMatch(thirdPlaceMatch)}
            className={clsx(
              'p-4 rounded-lg border cursor-pointer transition-all',
              shownPredictions[thirdPlaceMatch.id] ? 'border-blue-500/30 bg-blue-500/5' : 'border-[#1f2333] hover:border-[#2a2f42]'
            )}
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span>{new Date(thirdPlaceMatch.kickoff_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {FINISHED.includes(thirdPlaceMatch.status) ? (
                <span className="text-green-400 font-medium">Finalizado</span>
              ) : LIVE.includes(thirdPlaceMatch.status) ? (
                <span className="text-amber-400 font-medium animate-pulse">En juego</span>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {tpHome?.name && getFlagUrl(tpHome.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(tpHome.name)!} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-white">{tpHome?.name || 'Por clasificar'}</span>
              </div>
              <span className="text-sm font-bold text-zinc-400 tabular-nums flex-shrink-0">
                {FINISHED.includes(thirdPlaceMatch.status)
                  ? `${thirdPlaceMatch.home_goals_ft} – ${thirdPlaceMatch.away_goals_ft}`
                  : 'vs'}
              </span>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-sm font-medium text-white text-right">{tpAway?.name || 'Por clasificar'}</span>
                {tpAway?.name && getFlagUrl(tpAway.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(tpAway.name)!} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                )}
              </div>
            </div>
            {shownPredictions[thirdPlaceMatch.id] && (
              <div className="mt-3 pt-2 border-t border-[#1f2333] flex justify-between items-center text-xs">
                <span className="text-zinc-500">{isViewingOther ? `Predicción de ${viewedMember?.display_name}:` : 'Tu predicción:'}</span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
                  {shownPredictions[thirdPlaceMatch.id] === 'X' ? 'Empate' : shownPredictions[thirdPlaceMatch.id] === '1' ? 'Gana Local' : 'Gana Visitante'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prediction modal */}
      <AnimatePresence>
        {activePredictMatch && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-sm bg-[#13151c] border border-[#1f2333] rounded-xl p-6 relative shadow-2xl"
            >
              <button
                onClick={() => { setActivePredictMatch(null); setError(null) }}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-500 hover:bg-[#1f2333] hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <p className="text-xs font-medium text-zinc-500 mb-1">{PHASE_NAMES[activePredictMatch.phase]}</p>
              <h3 className="text-base font-semibold text-white mb-1 flex items-center gap-2 flex-wrap">
                {modalHome?.name && getFlagUrl(modalHome.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(modalHome.name)!} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                )}
                {modalHome?.name || 'Por clasificar'}
                <span className="text-zinc-600 font-normal">vs</span>
                {modalAway?.name && getFlagUrl(modalAway.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(modalAway.name)!} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                )}
                {modalAway?.name || 'Por clasificar'}
              </h3>
              <p className="text-xs text-zinc-500 mb-5">
                Cierre: {new Date(activePredictMatch.kickoff_at).toLocaleString('es-ES')}
              </p>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {isViewingOther ? (
                <div className="py-4 text-center text-sm text-zinc-500">
                  {!isMatchLocked ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Predicción de {viewedMember?.display_name} oculta hasta el kick-off.
                    </span>
                  ) : shownPredictions[activePredictMatch.id] ? (
                    <span>
                      Predicción de {viewedMember?.display_name}:{' '}
                      <span className="text-blue-400 font-semibold">
                        {shownPredictions[activePredictMatch.id] === 'X' ? 'Empate (90′)' : shownPredictions[activePredictMatch.id] === '1' ? 'Gana Local' : 'Gana Visitante'}
                      </span>
                    </span>
                  ) : (
                    <span>{viewedMember?.display_name} no hizo predicción para este partido.</span>
                  )}
                </div>
              ) : isMatchLocked ? (
                <div className="py-4 text-center text-sm text-zinc-500">Predicciones cerradas para este partido.</div>
              ) : !bothTeamsKnown ? (
                <div className="py-4 text-center text-sm text-zinc-500">
                  Completa los cruces anteriores para saber quién juega este partido y poder predecirlo.
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500">¿Qué equipo pasa?</p>
                  <div className="flex gap-2">
                    <TeamPickButton team={modalHome} selected={modalSide === '1'} disabled={saving} onPick={() => setModalSide('1')} />
                    <TeamPickButton team={modalAway} selected={modalSide === '2'} disabled={saving} onPick={() => setModalSide('2')} />
                  </div>

                  {activePredictMatch.phase !== 'third_place' && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setModalDraw((d) => !d)}
                      className={clsx(
                        'w-full flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition-all cursor-pointer disabled:opacity-50',
                        modalDraw
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                          : 'bg-[#0c0d12] border-[#1f2333] text-zinc-400 hover:border-[#2a2f42]'
                      )}
                    >
                      <span className={clsx(
                        'w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border',
                        modalDraw ? 'bg-amber-500 border-amber-500' : 'border-[#2a2f42]'
                      )}>
                        {modalDraw && <Check className="w-3 h-3 text-black" />}
                      </span>
                      <span>
                        Empate a 90′ — pasa en penaltis.{' '}
                        <span className="opacity-70">Puntúa <strong>X</strong>, el equipo elegido avanza igual.</span>
                      </span>
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-zinc-500">
                      Puntúa:{' '}
                      <span className="text-zinc-300 font-semibold">
                        {!modalSide ? '—' : modalDraw ? 'X (empate 90′)' : modalSide === '1' ? '1 (gana local)' : '2 (gana visitante)'}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={saving || !modalSide}
                      onClick={handlePredictSubmit}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
