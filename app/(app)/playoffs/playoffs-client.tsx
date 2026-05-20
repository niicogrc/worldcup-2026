'use client'

import React, { useState } from 'react'
import { SingleEliminationBracket, SVGViewer } from '@g-loot/react-tournament-brackets'
import { Database, MatchResult, TournamentPhase } from '@/lib/supabase/types'
import { Trophy, RefreshCw, X, AlertCircle } from 'lucide-react'
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

export default function PlayoffsClient({
  initialMatches,
  initialPredictions,
}: PlayoffsClientProps) {
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [activePredictMatch, setActivePredictMatch] = useState<MatchWithTeams | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 1. Filter out Third Place from the main tree, we will render it separately below
  const treeMatches = initialMatches.filter((m) => m.phase !== 'third_place')
  const thirdPlaceMatch = initialMatches.find((m) => m.phase === 'third_place')

  // 2. Group and sort matches by phase to build the structural bracket
  const r32 = treeMatches.filter((m) => m.phase === 'round_of_32').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const r16 = treeMatches.filter((m) => m.phase === 'round_of_16').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const qf = treeMatches.filter((m) => m.phase === 'quarter_final').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const sf = treeMatches.filter((m) => m.phase === 'semi_final').sort((a, b) => (a.match_number || 0) - (b.match_number || 0))
  const final = treeMatches.filter((m) => m.phase === 'final')

  // Map to bracket nodes
  const mappedMatches: any[] = []

  const addPhaseMatches = (matchesList: MatchWithTeams[], phasePrefix: string, roundText: string, nextPhasePrefix?: string) => {
    matchesList.forEach((match, index) => {
      const matchIdStr = `${phasePrefix}-${index}`
      let nextMatchId: string | null = null

      if (nextPhasePrefix) {
        const nextIndex = Math.floor(index / 2)
        nextMatchId = `${nextPhasePrefix}-${nextIndex}`
      }

      const predictedChoice = predictions[match.id]
      const homeName = match.home_team?.name || 'Por clasificar'
      const awayName = match.away_team?.name || 'Por clasificar'

      // Score or status text
      const isFinished = ['FT', 'AET', 'PEN'].includes(match.status)
      const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(match.status)
      let scoreText = ''
      if (isFinished) {
        scoreText = `${match.home_goals_ft} - ${match.away_goals_ft}`
      } else if (isLive) {
        scoreText = 'En juego ⚡'
      }

      mappedMatches.push({
        id: matchIdStr,
        name: `M${match.match_number || ''}`,
        nextMatchId,
        tournamentRoundText: roundText,
        state: isFinished ? 'DONE' : isLive ? 'LIVE' : 'SCHEDULED',
        dbMatch: match, // pass original db match row
        participants: [
          {
            id: match.home_team_id || `${matchIdStr}-home`,
            name: homeName,
            resultText: isFinished ? String(match.home_goals_ft) : null,
            isWinner: isFinished && (match.result_ft === '1'),
          },
          {
            id: match.away_team_id || `${matchIdStr}-away`,
            name: awayName,
            resultText: isFinished ? String(match.away_goals_ft) : null,
            isWinner: isFinished && (match.result_ft === '2'),
          },
        ],
      })
    })
  }

  // Build the levels of the tree
  addPhaseMatches(r32, 'R32', 'Dieciseisavos', 'R16')
  addPhaseMatches(r16, 'R16', 'Octavos', 'QF')
  addPhaseMatches(qf, 'QF', 'Cuartos', 'SF')
  addPhaseMatches(sf, 'SF', 'Semifinales', 'F')
  addPhaseMatches(final, 'F', 'Final', undefined)

  const handlePredictSubmit = async (choice: MatchResult) => {
    if (!activePredictMatch) return
    
    const matchId = activePredictMatch.id
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, prediction: choice }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save prediction')
      }

      setPredictions((prev) => ({ ...prev, [matchId]: choice }))
      setActivePredictMatch(null)
    } catch (err: any) {
      setError(err.message || 'Error guardando predicción')
    } finally {
      setSaving(false)
    }
  }

  // Custom Match component for the visual SVG bracket
  const CustomMatchNode = ({ match, onMatchClick }: any) => {
    const dbMatch = match.dbMatch as MatchWithTeams
    if (!dbMatch) return null

    const predicted = predictions[dbMatch.id]
    const isLocked = new Date(dbMatch.kickoff_at) <= new Date()
    const isFinished = ['FT', 'AET', 'PEN'].includes(dbMatch.status)
    const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(dbMatch.status)

    return (
      <div
        onClick={() => onMatchClick(dbMatch)}
        className={clsx(
          'w-full h-full p-3 rounded-lg border text-left cursor-pointer transition-all duration-200 bg-slate-900/90 backdrop-blur-md',
          predicted ? 'border-emerald-500/40 shadow-sm shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700',
          isFinished ? 'opacity-80' : ''
        )}
      >
        {/* Match Header */}
        <div className="flex justify-between items-center text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5">
          <span>Part. {dbMatch.match_number}</span>
          {isLive ? (
            <span className="text-amber-400 font-bold animate-pulse">En juego ⚡</span>
          ) : isFinished ? (
            <span className="text-slate-400">Fin</span>
          ) : (
            <span>{new Date(dbMatch.kickoff_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
          )}
        </div>

        {/* Participants names & prediction indicators */}
        <div className="space-y-1">
          {/* Home */}
          <div className="flex justify-between items-center text-xs">
            <span className={clsx(
              'truncate font-sans',
              predicted === '1' ? 'text-emerald-400 font-bold' : 'text-slate-300',
              match.participants[0].isWinner ? 'text-glow-emerald' : ''
            )}>
              {match.participants[0].name}
            </span>
            {isFinished && <span className="font-bebas text-slate-100">{match.participants[0].resultText}</span>}
          </div>
          
          {/* Away */}
          <div className="flex justify-between items-center text-xs">
            <span className={clsx(
              'truncate font-sans',
              predicted === '2' ? 'text-emerald-400 font-bold' : 'text-slate-300',
              match.participants[1].isWinner ? 'text-glow-emerald' : ''
            )}>
              {match.participants[1].name}
            </span>
            {isFinished && <span className="font-bebas text-slate-100">{match.participants[1].resultText}</span>}
          </div>
        </div>

        {/* User prediction badge */}
        {predicted && (
          <div className="mt-2 pt-1 border-t border-slate-800/40 flex justify-between items-center text-[9px]">
            <span className="text-slate-500">Predicción:</span>
            <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1 py-0.5 rounded border border-emerald-500/20">
              {predicted === 'X' ? 'Empate' : predicted === '1' ? 'Local' : 'Visitante'}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Visual Bracket container */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-900 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Predicho
          <span className="w-2.5 h-2.5 rounded bg-slate-900 border border-slate-800" /> Sin predecir
        </div>

        <h2 className="text-2xl font-bebas tracking-wide text-slate-100 mb-6 flex items-center gap-2">
          Bracket Principal
        </h2>

        {mappedMatches.length > 0 ? (
          <div className="overflow-x-auto min-h-[500px]">
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
                  roundHeader: { backgroundColor: 'transparent', fontColor: '#94a3b8' },
                  connectorColor: '#1e293b',
                  connectorColorHighlight: '#10b981',
                },
              }}
            />
          </div>
        ) : (
          <p className="text-center text-slate-500 py-12 font-sans">
            No hay partidos seeded para el bracket de Playoffs.
          </p>
        )}
      </div>

      {/* Standalone Third Place Match */}
      {thirdPlaceMatch && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-900 max-w-xl mx-auto">
          <h2 className="text-2xl font-bebas tracking-wide text-slate-100 mb-4 flex items-center gap-2">
            Partido por el Tercer Puesto
          </h2>

          <div
            onClick={() => setActivePredictMatch(thirdPlaceMatch)}
            className={clsx(
              'p-4 rounded-xl border cursor-pointer transition-all duration-200 bg-slate-900/60',
              predictions[thirdPlaceMatch.id] ? 'border-emerald-500/30' : 'border-slate-800 hover:border-slate-700'
            )}
          >
            <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
              <span>{new Date(thirdPlaceMatch.kickoff_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              {thirdPlaceMatch.status === 'FT' ? (
                <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Finalizado</span>
              ) : ['1H', 'HT', '2H', 'ET', 'P'].includes(thirdPlaceMatch.status) ? (
                <span className="text-amber-400 font-bold animate-pulse uppercase tracking-wider text-[10px]">En juego ⚡</span>
              ) : (
                <span className="text-slate-400 uppercase tracking-wider text-[10px]">Programado</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <span className="font-oswald uppercase text-slate-200">{thirdPlaceMatch.home_team?.name || 'TBD'}</span>
              <div className="font-bebas text-2xl text-slate-400">
                {thirdPlaceMatch.status === 'FT' ? `${thirdPlaceMatch.home_goals_ft} - ${thirdPlaceMatch.away_goals_ft}` : 'VS'}
              </div>
              <span className="font-oswald uppercase text-slate-200 text-right">{thirdPlaceMatch.away_team?.name || 'TBD'}</span>
            </div>

            {predictions[thirdPlaceMatch.id] && (
              <div className="mt-3 pt-3 border-t border-slate-800/40 flex justify-between items-center text-xs">
                <span className="text-slate-500">Predicción:</span>
                <span className="bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                  {predictions[thirdPlaceMatch.id] === 'X' ? 'Empate' : predictions[thirdPlaceMatch.id] === '1' ? 'Gana Local' : 'Gana Visitante'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interactive Prediction Popup Modal */}
      <AnimatePresence>
        {activePredictMatch && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 relative shadow-2xl"
            >
              <button
                onClick={() => setActivePredictMatch(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-bebas tracking-wide text-slate-100 mb-2 uppercase">
                {PHASE_NAMES[activePredictMatch.phase]}
              </h3>
              <p className="text-xs text-slate-400 font-sans mb-6">
                Predice quién ganará o si habrá empate al finalizar los 90 minutos reglamentarios.
              </p>

              {error && (
                <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Match Card */}
              <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl mb-6 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-oswald mb-3">
                  Cierre: {new Date(activePredictMatch.kickoff_at).toLocaleString('es-ES')}
                </p>

                <div className="flex items-center justify-between gap-4 font-oswald text-sm">
                  <span className="flex-1 text-right uppercase text-slate-200">{activePredictMatch.home_team?.name || 'Por Clasificar'}</span>
                  <span className="text-slate-500">VS</span>
                  <span className="flex-1 text-left uppercase text-slate-200">{activePredictMatch.away_team?.name || 'Por Clasificar'}</span>
                </div>
              </div>

              {/* Prediction Options */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  disabled={saving || (new Date(activePredictMatch.kickoff_at) <= new Date())}
                  onClick={() => handlePredictSubmit('1')}
                  className={clsx(
                    'py-3.5 px-4 rounded-xl font-oswald uppercase tracking-wider text-sm transition-all cursor-pointer flex flex-col items-center gap-1',
                    predictions[activePredictMatch.id] === '1'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 border border-slate-900 text-slate-300 hover:border-slate-800'
                  )}
                >
                  <span className="font-bebas text-lg">1</span>
                  <span className="text-[9px] uppercase opacity-75">Local</span>
                </button>

                <button
                  disabled={saving || (new Date(activePredictMatch.kickoff_at) <= new Date())}
                  onClick={() => handlePredictSubmit('X')}
                  className={clsx(
                    'py-3.5 px-4 rounded-xl font-oswald uppercase tracking-wider text-sm transition-all cursor-pointer flex flex-col items-center gap-1',
                    predictions[activePredictMatch.id] === 'X'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 border border-slate-900 text-slate-300 hover:border-slate-800'
                  )}
                >
                  <span className="font-bebas text-lg">X</span>
                  <span className="text-[9px] uppercase opacity-75">Empate</span>
                </button>

                <button
                  disabled={saving || (new Date(activePredictMatch.kickoff_at) <= new Date())}
                  onClick={() => handlePredictSubmit('2')}
                  className={clsx(
                    'py-3.5 px-4 rounded-xl font-oswald uppercase tracking-wider text-sm transition-all cursor-pointer flex flex-col items-center gap-1',
                    predictions[activePredictMatch.id] === '2'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-950 border border-slate-900 text-slate-300 hover:border-slate-800'
                  )}
                >
                  <span className="font-bebas text-lg">2</span>
                  <span className="text-[9px] uppercase opacity-75">Visitante</span>
                </button>
              </div>

              {saving && (
                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-emerald-400 font-sans">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Guardando predicción...
                </div>
              )}

              {new Date(activePredictMatch.kickoff_at) <= new Date() && (
                <p className="mt-4 text-center text-xs text-rose-400 font-sans">
                  Este partido ya ha comenzado. Las predicciones están bloqueadas.
                </p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
