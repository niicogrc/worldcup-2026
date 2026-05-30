'use client'

import React, { useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Database, MatchResult, TournamentPhase } from '@/lib/supabase/types'
import { getFlagUrl } from '@/lib/flags'
import { X, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { motion, AnimatePresence } from 'framer-motion'

type MatchWithTeams = Database['public']['Tables']['matches']['Row'] & {
  home_team: { id: string; name: string; flag_url: string | null; short_code: string | null } | null
  away_team: { id: string; name: string; flag_url: string | null; short_code: string | null } | null
}
type PredictionRow = Database['public']['Tables']['predictions']['Row']

interface PlayoffsClientProps {
  initialMatches: MatchWithTeams[]
  initialPredictions: PredictionRow[]
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

export default function PlayoffsClient({ initialMatches, initialPredictions }: PlayoffsClientProps) {
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [activePredictMatch, setActivePredictMatch] = useState<MatchWithTeams | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const treeMatches = initialMatches.filter((m) => m.phase !== 'third_place')
  const thirdPlaceMatch = initialMatches.find((m) => m.phase === 'third_place')

  const r32 = treeMatches.filter((m) => m.phase === 'round_of_32').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const r16 = treeMatches.filter((m) => m.phase === 'round_of_16').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const qf = treeMatches.filter((m) => m.phase === 'quarter_final').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const sf = treeMatches.filter((m) => m.phase === 'semi_final').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const final = treeMatches.filter((m) => m.phase === 'final')

  const mappedMatches: any[] = []

  const addPhaseMatches = (matchesList: MatchWithTeams[], phasePrefix: string, roundText: string, nextPhasePrefix?: string) => {
    matchesList.forEach((match, index) => {
      const matchIdStr = `${phasePrefix}-${index}`
      const nextMatchId = nextPhasePrefix ? `${nextPhasePrefix}-${Math.floor(index / 2)}` : null
      const predictedChoice = predictions[match.id]
      const isFinished = ['FT', 'AET', 'PEN'].includes(match.status)
      const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(match.status)

      mappedMatches.push({
        id: matchIdStr,
        name: `M${match.match_number || ''}`,
        nextMatchId,
        tournamentRoundText: roundText,
        state: isFinished ? 'DONE' : isLive ? 'LIVE' : 'SCHEDULED',
        dbMatch: match,
        participants: [
          {
            id: match.home_team_id || `${matchIdStr}-home`,
            name: match.home_team?.name || 'Por clasificar',
            resultText: isFinished ? String(match.home_goals_ft) : null,
            isWinner: isFinished && match.result_ft === '1',
          },
          {
            id: match.away_team_id || `${matchIdStr}-away`,
            name: match.away_team?.name || 'Por clasificar',
            resultText: isFinished ? String(match.away_goals_ft) : null,
            isWinner: isFinished && match.result_ft === '2',
          },
        ],
        predictedChoice,
      })
    })
  }

  addPhaseMatches(r32, 'R32', 'Dieciseisavos', 'R16')
  addPhaseMatches(r16, 'R16', 'Octavos', 'QF')
  addPhaseMatches(qf, 'QF', 'Cuartos', 'SF')
  addPhaseMatches(sf, 'SF', 'Semifinales', 'F')
  addPhaseMatches(final, 'F', 'Final', undefined)

  const handlePredictSubmit = async (choice: MatchResult) => {
    if (!activePredictMatch) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activePredictMatch.id, prediction: choice }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setPredictions((prev) => ({ ...prev, [activePredictMatch.id]: choice }))
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
    const predicted = predictions[dbMatch.id]
    const isFinished = ['FT', 'AET', 'PEN'].includes(dbMatch.status)
    const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(dbMatch.status)

    return (
      <div
        onClick={() => onMatchClick(dbMatch)}
        className={clsx(
          'w-full h-full p-2.5 rounded-lg border text-left cursor-pointer transition-all duration-150',
          'bg-[#13151c]',
          predicted ? 'border-blue-500/30' : 'border-[#1f2333] hover:border-[#2a2f42]'
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
            const pred = i === 0 ? '1' : '2'
            return (
              <div key={i} className="flex justify-between items-center gap-1 text-xs">
                <div className="flex items-center gap-1 min-w-0">
                  {flagUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={flagUrl} alt={teamName} className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                  )}
                  <span className={clsx(
                    'truncate',
                    predictions[dbMatch.id] === pred ? 'text-blue-400 font-semibold' : 'text-zinc-300',
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
        {predicted && (
          <div className="mt-1.5 pt-1 border-t border-[#1f2333] text-[9px] flex justify-between">
            <span className="text-zinc-600">Pred:</span>
            <span className="text-blue-400 font-semibold">
              {predicted === 'X' ? 'X' : predicted === '1' ? '1' : '2'}
            </span>
          </div>
        )}
      </div>
    )
  }

  const isMatchLocked = activePredictMatch ? new Date(activePredictMatch.kickoff_at) <= new Date() : false

  return (
    <div className="space-y-6">
      {/* Bracket */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Bracket de eliminatorias</h2>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded bg-blue-500" /> Predicho
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
                <CustomMatchNode {...props} onMatchClick={setActivePredictMatch} />
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
            onClick={() => setActivePredictMatch(thirdPlaceMatch)}
            className={clsx(
              'p-4 rounded-lg border cursor-pointer transition-all',
              predictions[thirdPlaceMatch.id] ? 'border-blue-500/30 bg-blue-500/5' : 'border-[#1f2333] hover:border-[#2a2f42]'
            )}
          >
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
              <span>{new Date(thirdPlaceMatch.kickoff_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {['FT', 'AET', 'PEN'].includes(thirdPlaceMatch.status) ? (
                <span className="text-green-400 font-medium">Finalizado</span>
              ) : ['1H', 'HT', '2H', 'ET', 'P'].includes(thirdPlaceMatch.status) ? (
                <span className="text-amber-400 font-medium animate-pulse">En juego</span>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {thirdPlaceMatch.home_team?.name && getFlagUrl(thirdPlaceMatch.home_team.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(thirdPlaceMatch.home_team.name)!} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-white">{thirdPlaceMatch.home_team?.name || 'TBD'}</span>
              </div>
              <span className="text-sm font-bold text-zinc-400 tabular-nums flex-shrink-0">
                {['FT', 'AET', 'PEN'].includes(thirdPlaceMatch.status)
                  ? `${thirdPlaceMatch.home_goals_ft} – ${thirdPlaceMatch.away_goals_ft}`
                  : 'vs'}
              </span>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-sm font-medium text-white text-right">{thirdPlaceMatch.away_team?.name || 'TBD'}</span>
                {thirdPlaceMatch.away_team?.name && getFlagUrl(thirdPlaceMatch.away_team.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(thirdPlaceMatch.away_team.name)!} alt="" className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                )}
              </div>
            </div>
            {predictions[thirdPlaceMatch.id] && (
              <div className="mt-3 pt-2 border-t border-[#1f2333] flex justify-between items-center text-xs">
                <span className="text-zinc-500">Tu predicción:</span>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
                  {predictions[thirdPlaceMatch.id] === 'X' ? 'Empate' : predictions[thirdPlaceMatch.id] === '1' ? 'Gana Local' : 'Gana Visitante'}
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
                {activePredictMatch.home_team?.name && getFlagUrl(activePredictMatch.home_team.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(activePredictMatch.home_team.name)!} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                )}
                {activePredictMatch.home_team?.name || 'Por clasificar'}
                <span className="text-zinc-600 font-normal">vs</span>
                {activePredictMatch.away_team?.name && getFlagUrl(activePredictMatch.away_team.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(activePredictMatch.away_team.name)!} alt="" className="w-5 h-3.5 object-cover rounded-sm" />
                )}
                {activePredictMatch.away_team?.name || 'Por clasificar'}
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

              {isMatchLocked ? (
                <div className="py-4 text-center text-sm text-zinc-500">Predicciones cerradas para este partido.</div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {([['1', 'Local'], ['X', 'Empate'], ['2', 'Visitante']] as [MatchResult, string][]).map(([opt, label]) => (
                    <button
                      key={opt}
                      disabled={saving}
                      onClick={() => handlePredictSubmit(opt)}
                      className={clsx(
                        'py-4 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 flex flex-col items-center gap-1',
                        predictions[activePredictMatch.id] === opt
                          ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                          : 'bg-[#0c0d12] border border-[#1f2333] text-zinc-300 hover:border-blue-500/30 hover:text-white'
                      )}
                    >
                      <span className="text-lg font-bold">{opt}</span>
                      <span className="text-[10px] opacity-75">{label}</span>
                    </button>
                  ))}
                </div>
              )}

              {saving && <p className="text-center text-xs text-zinc-500 mt-3">Guardando...</p>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
