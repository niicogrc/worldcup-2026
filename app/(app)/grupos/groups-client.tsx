'use client'

import React, { useState } from 'react'
import { Database, MatchResult } from '@/lib/supabase/types'
import { getFlagUrl } from '@/lib/flags'
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
  porraId: string
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function formatKickoff(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GroupsClient({ initialMatches, initialPredictions, standings, porraId }: GroupsClientProps) {
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const groupMatches = initialMatches.filter((m) => m.group_letter === selectedGroup)
  const groupStandings = standings.filter((s) => s.group_letter === selectedGroup)

  const handlePredict = async (matchId: string, choice: MatchResult) => {
    const prev = predictions[matchId]
    setPredictions((p) => ({ ...p, [matchId]: choice }))
    setSavingMatchId(matchId)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, prediction: choice, porraId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
    } catch (err: any) {
      setPredictions((p) => {
        const next = { ...p }
        if (prev) next[matchId] = prev
        else delete next[matchId]
        return next
      })
      setErrorMsg(err.message)
    } finally {
      setSavingMatchId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Group tabs */}
      <div className="flex gap-1 flex-wrap">
        {GROUPS.map((g) => (
          <button
            key={g}
            onClick={() => setSelectedGroup(g)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
              selectedGroup === g
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
            )}
          >
            Grupo {g}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Matches */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-medium text-zinc-500">Partidos · Grupo {selectedGroup}</h2>

          {groupMatches.length === 0 && (
            <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-8 text-center text-zinc-500 text-sm">
              No hay partidos cargados. Ejecuta el seed.
            </div>
          )}

          {groupMatches.map((match) => {
            const myPred = predictions[match.id]
            const isLocked = new Date(match.kickoff_at) <= new Date()
            const isSaving = savingMatchId === match.id
            const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(match.status)
            const isFinished = ['FT', 'AET', 'PEN'].includes(match.status)
            const predRow = initialPredictions.find((p) => p.match_id === match.id)
            const wasCorrect = predRow?.is_correct

            return (
              <div
                key={match.id}
                className={clsx(
                  'bg-[#13151c] border rounded-xl overflow-hidden transition-all',
                  wasCorrect === true ? 'border-green-500/30' : wasCorrect === false ? 'border-red-500/10' : 'border-[#1f2333]'
                )}
              >
                {/* Header row */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f2333] bg-[#191c26]">
                  <span className="text-xs text-zinc-500">Partido {match.match_number}</span>
                  <div className="flex items-center gap-2">
                    {isLive && <span className="text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full animate-pulse">En juego</span>}
                    {isFinished && <span className="text-[10px] font-medium text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Finalizado</span>}
                    {!isLive && !isFinished && <span className="text-xs text-zinc-500">{formatKickoff(match.kickoff_at)}</span>}
                    {isFinished && (
                      <span className="text-sm font-bold text-white tabular-nums">
                        {match.home_goals_ft} – {match.away_goals_ft}
                      </span>
                    )}
                  </div>
                </div>

                {/* Teams + prediction */}
                <div className="px-4 py-3 flex items-center gap-3">
                  {/* Home */}
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="text-sm font-medium text-white truncate text-right">{match.home_team?.name}</span>
                    {match.home_team?.name && getFlagUrl(match.home_team.name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getFlagUrl(match.home_team.name)!} alt={match.home_team.name} className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono bg-[#1f2333] text-zinc-400 px-1.5 py-0.5 rounded flex-shrink-0">{match.home_team?.short_code}</span>
                    )}
                  </div>

                  {/* 1/X/2 buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {(['1', 'X', '2'] as MatchResult[]).map((opt) => (
                      <button
                        key={opt}
                        disabled={isLocked || isSaving}
                        onClick={() => handlePredict(match.id, opt)}
                        className={clsx(
                          'w-10 h-9 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40',
                          myPred === opt
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                            : 'bg-[#1f2333] text-zinc-400 hover:bg-[#2a2f42] hover:text-white'
                        )}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {/* Away */}
                  <div className="flex-1 flex items-center justify-start gap-2 min-w-0">
                    {match.away_team?.name && getFlagUrl(match.away_team.name) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getFlagUrl(match.away_team.name)!} alt={match.away_team.name} className="w-6 h-4 object-cover rounded-sm flex-shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono bg-[#1f2333] text-zinc-400 px-1.5 py-0.5 rounded flex-shrink-0">{match.away_team?.short_code}</span>
                    )}
                    <span className="text-sm font-medium text-white truncate">{match.away_team?.name}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-[#1f2333]">
                  <span className={clsx('text-[11px]', isLocked ? 'text-zinc-600' : 'text-blue-400/80')}>
                    {isLocked ? 'Predicciones cerradas' : 'Abierto para predecir'}
                  </span>
                  {isFinished && wasCorrect !== null && (
                    <span className={clsx('text-[11px] font-semibold', wasCorrect ? 'text-green-400' : 'text-zinc-600')}>
                      {wasCorrect ? '✓ +3 pts' : '✗ +0 pts'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Standings */}
        <div>
          <h2 className="text-sm font-medium text-zinc-500 mb-3">Clasificación · Grupo {selectedGroup}</h2>
          <div className="bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1f2333] text-zinc-500 font-medium">
                  <th className="py-2.5 px-3 text-center w-8">#</th>
                  <th className="py-2.5 px-3 text-left">Equipo</th>
                  <th className="py-2.5 px-2 text-center">PJ</th>
                  <th className="py-2.5 px-2 text-center">DG</th>
                  <th className="py-2.5 px-3 text-center">Pts</th>
                </tr>
              </thead>
              <tbody>
                {groupStandings.map((row) => (
                  <tr key={row.id} className="border-b border-[#1f2333] last:border-0">
                    <td className="py-2.5 px-3 text-center text-zinc-500">{row.position}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {row.team?.name && getFlagUrl(row.team.name) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getFlagUrl(row.team.name)!} alt={row.team.name} className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" />
                        )}
                        <span className="font-medium text-white truncate max-w-[100px]">{row.team?.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center text-zinc-400 tabular-nums">{row.played}</td>
                    <td className={clsx('py-2.5 px-2 text-center tabular-nums font-medium',
                      row.goal_diff > 0 ? 'text-green-400' : row.goal_diff < 0 ? 'text-red-400' : 'text-zinc-400'
                    )}>
                      {row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white tabular-nums">{row.points}</td>
                  </tr>
                ))}
                {groupStandings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-600">Sin datos</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
