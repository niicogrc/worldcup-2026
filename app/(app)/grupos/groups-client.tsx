'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Eye, Loader2, Lock, X } from 'lucide-react'
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

type PorraMember = { user_id: string; display_name: string; avatar_url: string | null }
type ViewedPrediction = { match_id: string; prediction: MatchResult; is_correct: boolean | null; points_awarded: number | null }

interface GroupsClientProps {
  initialMatches: MatchWithTeams[]
  initialPredictions: PredictionRow[]
  standings: StandingWithTeam[]
  porraId: string
  importablePorras: { id: string; name: string }[]
  members: PorraMember[]
  currentUserId: string
}

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function formatKickoff(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function GroupsClient({ initialMatches, initialPredictions, standings, porraId, importablePorras, members, currentUserId }: GroupsClientProps) {
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState('A')
  const [predictions, setPredictions] = useState<Record<string, MatchResult>>(
    initialPredictions.reduce((acc, p) => ({ ...acc, [p.match_id]: p.prediction }), {})
  )
  const [savingMatchId, setSavingMatchId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [importBannerVisible, setImportBannerVisible] = useState(
    initialPredictions.length === 0 && importablePorras.length > 0
  )
  const [importingFromId, setImportingFromId] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  // Ver predicciones de otro miembro de la porra (solo lectura)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [viewedCache, setViewedCache] = useState<Record<string, ViewedPrediction[]>>({})
  const [loadingMemberId, setLoadingMemberId] = useState<string | null>(null)

  const isViewingOther = viewingUserId !== null && viewingUserId !== currentUserId
  const viewedMember = isViewingOther ? members.find((m) => m.user_id === viewingUserId) : null
  const viewedRows = isViewingOther ? (viewedCache[viewingUserId!] ?? []) : []
  const viewedPredictions = viewedRows.reduce<Record<string, MatchResult>>(
    (acc, p) => ({ ...acc, [p.match_id]: p.prediction }),
    {}
  )

  const otherMembers = members.filter((m) => m.user_id !== currentUserId)

  const groupMatches = initialMatches.filter((m) => m.group_letter === selectedGroup)
  const groupStandings = standings.filter((s) => s.group_letter === selectedGroup)

  const handleViewMember = async (userId: string | null) => {
    setErrorMsg(null)
    if (userId === null || userId === currentUserId) {
      setViewingUserId(null)
      return
    }
    setViewingUserId(userId)
    if (viewedCache[userId]) return

    setLoadingMemberId(userId)
    try {
      const res = await fetch(`/api/porras/${porraId}/predictions?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al cargar las predicciones')
      setViewedCache((c) => ({ ...c, [userId]: data }))
    } catch (err: any) {
      setErrorMsg(err.message)
      setViewingUserId(null)
    } finally {
      setLoadingMemberId(null)
    }
  }

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

  const handleImport = async (sourcePorraId: string) => {
    setImportingFromId(sourcePorraId)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/porras/${porraId}/import-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePorraId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al importar')

      setPredictions((p) => ({
        ...p,
        ...(data.predictions ?? []).reduce(
          (acc: Record<string, MatchResult>, row: { match_id: string; prediction: MatchResult }) => ({ ...acc, [row.match_id]: row.prediction }),
          {}
        ),
      }))
      setImportedCount(data.imported ?? 0)
      setImportBannerVisible(false)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setImportingFromId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Member viewer */}
      {otherMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Eye className="w-3.5 h-3.5" />
            Viendo predicciones de
          </span>
          <button
            onClick={() => handleViewMember(null)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
              !isViewingOther
                ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
            )}
          >
            Tú
          </button>
          {otherMembers.map((m) => (
            <button
              key={m.user_id}
              onClick={() => handleViewMember(m.user_id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer',
                viewingUserId === m.user_id
                  ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                  : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
              )}
            >
              {loadingMemberId === m.user_id && <Loader2 className="w-3 h-3 animate-spin" />}
              {m.display_name}
            </button>
          ))}
        </div>
      )}

      {isViewingOther && (
        <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-sm flex items-center gap-2">
          <Eye className="w-4 h-4 flex-shrink-0" />
          <span>
            Estás viendo las predicciones de <strong>{viewedMember?.display_name}</strong>. Solo se muestran las de partidos ya empezados; las demás permanecen ocultas hasta el kick-off.
          </span>
        </div>
      )}

      {/* Import banner */}
      {!isViewingOther && importBannerVisible && (
        <div className="bg-[#13151c] border border-blue-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-4 h-4 text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold">Aún no tienes predicciones en esta porra</p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Puedes importar las que ya hiciste en otra porra (solo partidos sin empezar) o hacerlas de cero.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {importablePorras.map((p) => (
              <button
                key={p.id}
                disabled={importingFromId !== null}
                onClick={() => handleImport(p.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                {importingFromId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Importar de {p.name}
              </button>
            ))}
            <button
              disabled={importingFromId !== null}
              onClick={() => setImportBannerVisible(false)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#1f2333] hover:bg-[#2a2f42] disabled:opacity-40 text-zinc-300 text-xs font-medium rounded-lg transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Hacerlas de cero
            </button>
          </div>
        </div>
      )}

      {importedCount !== null && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">
          {importedCount > 0
            ? `Se han importado ${importedCount} predicciones. Puedes modificarlas mientras los partidos no hayan empezado.`
            : 'No había predicciones que importar (los partidos ya habían empezado o ya las tenías).'}
        </div>
      )}

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
            const myPred = isViewingOther ? viewedPredictions[match.id] : predictions[match.id]
            const isLocked = new Date(match.kickoff_at) <= new Date()
            const isSaving = savingMatchId === match.id
            const isLive = ['1H', 'HT', '2H', 'ET', 'P'].includes(match.status)
            const isFinished = ['FT', 'AET', 'PEN'].includes(match.status)
            const predRow = isViewingOther
              ? viewedRows.find((p) => p.match_id === match.id)
              : initialPredictions.find((p) => p.match_id === match.id)
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
                        disabled={isLocked || isSaving || isViewingOther}
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
                  {isViewingOther && !isLocked ? (
                    <span className="flex items-center gap-1 text-[11px] text-zinc-600">
                      <Lock className="w-3 h-3" />
                      Predicción oculta hasta el kick-off
                    </span>
                  ) : (
                    <span className={clsx('text-[11px]', isLocked ? 'text-zinc-600' : 'text-blue-400/80')}>
                      {isLocked ? 'Predicciones cerradas' : 'Abierto para predecir'}
                    </span>
                  )}
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
