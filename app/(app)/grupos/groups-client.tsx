'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Database, MatchResult } from '@/lib/supabase/types'
import { Calendar, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

type MatchWithTeams = Database['public']['Tables']['matches']['Row'] & {
  home_team: { id: string; name: string; flag_url: string | null; group_letter: string | null; short_code: string | null } | null
  away_team: { id: string; name: string; flag_url: string | null; group_letter: string | null; short_code: string | null } | null
}
type PredictionRow = Database['public']['Tables']['predictions']['Row']
type StandingWithTeam = Database['public']['Tables']['group_standings']['Row'] & {
  team: { id: string; name: string; flag_url: string | null; short_code: string | null } | null
}

interface GroupsClientProps {
  initialMatches: MatchWithTeams[]
  initialPredictions: PredictionRow[]
  standings: StandingWithTeam[]
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

export default function GroupsClient({
  initialMatches,
  initialPredictions,
  standings,
}: GroupsClientProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('A')
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Filter matches and standings for the selected group
  const groupMatches = initialMatches.filter((m) => m.group_letter === selectedGroup)
  const groupStandings = standings.filter((s) => s.group_letter === selectedGroup)

  const handlePredict = async (matchId: string, choice: MatchResult) => {
    // Optimistic update
    const previousPrediction = predictions[matchId]
    setPredictions((prev) => ({ ...prev, [matchId]: choice }))
    setSavingMatchId(matchId)
    setErrorMessage(null)

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
    } catch (err: any) {
      // Revert prediction on error
      if (previousPrediction) {
        setPredictions((prev) => ({ ...prev, [matchId]: previousPrediction }))
      } else {
        setPredictions((prev) => {
          const next = { ...prev }
          delete next[matchId]
          return next
        })
      }
      setErrorMessage(err.message || 'Error guardando predicción')
    } finally {
      setSavingMatchId(null)
    }
  }

  const formatKickoff = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-8">
      {/* Group selector tabs */}
      <div className="overflow-x-auto pb-2 border-b border-slate-900">
        <div className="flex gap-1.5 min-w-max">
          {GROUPS.map((letter) => (
            <button
              key={letter}
              onClick={() => setSelectedGroup(letter)}
              className={clsx(
                'px-4 py-2 rounded-lg font-oswald uppercase tracking-wider text-sm transition-all cursor-pointer',
                selectedGroup === letter
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              )}
            >
              Grupo {letter}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center gap-3 text-sm font-sans animate-pulse">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Matches list + Standings sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Matches Section */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-2xl font-bebas tracking-wide text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Partidos del Grupo {selectedGroup}
          </h2>

          <div className="space-y-4">
            {groupMatches.map((match) => {
              const myPrediction = predictions[match.id]
              const isLocked = new Date(match.kickoff_at) <= new Date()
              const isSaving = savingMatchId === match.id

              // Determine status text / display
              const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(match.status)
              const isFinished = ['FT', 'AET', 'PEN'].includes(match.status)

              let statusBadge = (
                <span className="text-[10px] text-slate-400 border border-slate-800 py-0.5 px-2 rounded font-sans uppercase">
                  {formatKickoff(match.kickoff_at)}
                </span>
              )

              if (isLive) {
                statusBadge = (
                  <span className="text-[10px] text-slate-950 bg-amber-400 border border-amber-500 py-0.5 px-2 rounded font-oswald uppercase tracking-wide animate-pulse">
                    En juego ⚡
                  </span>
                )
              } else if (isFinished) {
                statusBadge = (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded font-oswald uppercase tracking-wide">
                    Finalizado
                  </span>
                )
              }

              // Scoring feedback
              const predictionItem = initialPredictions.find((p) => p.match_id === match.id)
              const wasCorrect = predictionItem?.is_correct

              return (
                <div
                  key={match.id}
                  className={clsx(
                    'glass-panel p-5 rounded-2xl border transition-all duration-300 relative',
                    isLocked ? 'opacity-85' : 'hover:border-slate-800',
                    wasCorrect === true && 'border-emerald-500/30 bg-emerald-500/[0.02]',
                    wasCorrect === false && 'border-rose-500/10'
                  )}
                >
                  {/* Top bar info */}
                  <div className="flex items-center justify-between mb-4 border-b border-slate-900/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-oswald text-slate-500 uppercase tracking-wider">
                        Partido {match.match_number}
                      </span>
                      {statusBadge}
                    </div>

                    {isFinished && (
                      <div className="flex items-center gap-2 font-bebas text-2xl tracking-wider text-slate-100">
                        {match.home_goals_ft} - {match.away_goals_ft}
                      </div>
                    )}
                  </div>

                  {/* Teams vs row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    {/* Home Team */}
                    <div className="flex-1 flex items-center justify-end gap-3 w-full sm:w-auto">
                      <span className="font-oswald text-base uppercase text-slate-200 text-right">
                        {match.home_team?.name}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center font-bebas text-slate-400 text-lg">
                        {match.home_team?.short_code || '??'}
                      </div>
                    </div>

                    {/* Prediction buttons wrapper */}
                    <div className="flex items-center justify-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-900 max-w-[240px] w-full relative">
                      {isSaving && (
                        <div className="absolute inset-0 bg-slate-950/70 rounded-xl flex items-center justify-center z-10">
                          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                        </div>
                      )}

                      <button
                        disabled={isLocked || isSaving}
                        onClick={() => handlePredict(match.id, '1')}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-bebas text-lg tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                          myPrediction === '1'
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                        )}
                      >
                        1
                      </button>

                      <button
                        disabled={isLocked || isSaving}
                        onClick={() => handlePredict(match.id, 'X')}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-bebas text-lg tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                          myPrediction === 'X'
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                        )}
                      >
                        X
                      </button>

                      <button
                        disabled={isLocked || isSaving}
                        onClick={() => handlePredict(match.id, '2')}
                        className={clsx(
                          'flex-1 py-2 px-3 rounded-lg font-bebas text-lg tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
                          myPrediction === '2'
                            ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                            : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                        )}
                      >
                        2
                      </button>
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex items-center justify-start gap-3 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-850 flex items-center justify-center font-bebas text-slate-400 text-lg">
                        {match.away_team?.short_code || '??'}
                      </div>
                      <span className="font-oswald text-base uppercase text-slate-200 text-left">
                        {match.away_team?.name}
                      </span>
                    </div>
                  </div>

                  {/* Prediction Lock / Puntos status bar */}
                  <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-900/40 text-xs">
                    <div>
                      {isLocked ? (
                        <span className="text-slate-500 font-sans italic flex items-center gap-1">
                          Predicciones cerradas
                        </span>
                      ) : (
                        <span className="text-emerald-400/80 font-sans flex items-center gap-1">
                          Abierto para predicciones
                        </span>
                      )}
                    </div>

                    {isFinished && wasCorrect !== null && (
                      <div>
                        {wasCorrect ? (
                          <span className="text-emerald-400 font-bebas text-sm flex items-center gap-1 uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5" /> +3 PUNTOS ACIERTO
                          </span>
                        ) : (
                          <span className="text-slate-500 font-bebas text-sm flex items-center gap-1 uppercase tracking-wider">
                            FALLADO (+0 PTS)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {groupMatches.length === 0 && (
              <p className="text-center text-slate-500 py-8 font-sans">
                No hay partidos cargados para el Grupo {selectedGroup}. Ejecuta la inicialización de partidos.
              </p>
            )}
          </div>
        </div>

        {/* Group Standings Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bebas tracking-wide text-slate-100 flex items-center gap-2">
            Clasificación Grupo {selectedGroup}
          </h2>

          <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 font-oswald uppercase text-slate-400">
                    <th className="py-3 px-4 text-center w-8">Pos</th>
                    <th className="py-3 px-4">Equipo</th>
                    <th className="py-3 px-3 text-center">PJ</th>
                    <th className="py-3 px-3 text-center">DG</th>
                    <th className="py-3 px-4 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/50">
                  {groupStandings.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-900/20">
                      <td className="py-3 px-4 text-center font-oswald text-slate-400">
                        {row.position}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200 truncate max-w-[120px]">
                        {row.team?.name}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400">
                        {row.played}
                      </td>
                      <td className={clsx(
                        'py-3 px-3 text-center font-medium',
                        row.goal_diff > 0 ? 'text-emerald-400' : row.goal_diff < 0 ? 'text-rose-500' : 'text-slate-400'
                      )}>
                        {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                      </td>
                      <td className="py-3 px-4 text-center font-bebas text-sm text-slate-100">
                        {row.points}
                      </td>
                    </tr>
                  ))}

                  {groupStandings.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                        Sin datos de tabla
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
