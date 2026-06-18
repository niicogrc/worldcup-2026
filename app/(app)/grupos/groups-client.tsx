'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, Lock, X } from 'lucide-react'
import { Database, MatchResult } from '@/lib/supabase/types'
import { getFlagUrl } from '@/lib/flags'
import { clsx } from 'clsx'
import { useMemberView, PorraMember } from '@/lib/hooks/use-member-view'
import MemberViewBar from '@/components/porra/member-view-bar'

type MatchWithTeams = Database['public']['Tables']['matches']['Row'] & {
  home_team: { id: string; name: string; flag_url: string | null; group_letter: string | null; short_code: string | null } | null
  away_team: { id: string; name: string; flag_url: string | null; group_letter: string | null; short_code: string | null } | null
}
type PredictionRow = Database['public']['Tables']['predictions']['Row']

interface GroupsClientProps {
  initialMatches: MatchWithTeams[]
  initialPredictions: PredictionRow[]
  porraId: string
  importablePorras: { id: string; name: string }[]
  members: PorraMember[]
  currentUserId: string
  initialViewUserId?: string | null
}

const FINISHED_STATUSES = ['FT', 'AET', 'PEN']

function formatKickoff(dateStr: string) {
  return new Date(dateStr).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Agrupa una lista de partidos (ya ordenada) por día de kick-off.
function groupByDay(matches: MatchWithTeams[]) {
  return matches.reduce<{ date: string; matches: MatchWithTeams[] }[]>((acc, m) => {
    const date = new Date(m.kickoff_at).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' })
    const last = acc[acc.length - 1]
    if (last && last.date === date) last.matches.push(m)
    else acc.push({ date, matches: [m] })
    return acc
  }, [])
}

export default function GroupsClient({ initialMatches, initialPredictions, porraId, importablePorras, members, currentUserId, initialViewUserId }: GroupsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
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
  const {
    viewingUserId, isViewingOther, viewedMember, viewedRows, viewedPredictions,
    loadingMemberId, viewError, viewMember,
  } = useMemberView(porraId, currentUserId, members, initialViewUserId)

  // Vista única cronológica: todos los partidos en orden de kick-off, separados
  // en dos tabs. "Próximos" = aún no finalizados (sin empezar o en juego);
  // "Pasados" = finalizados (FT/AET/PEN). Cada tab se agrupa por día.
  const chronologicalMatches = [...initialMatches].sort(
    (a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime()
  )
  const upcomingMatches = chronologicalMatches.filter((m) => !FINISHED_STATUSES.includes(m.status))
  const pastMatches = chronologicalMatches.filter((m) => FINISHED_STATUSES.includes(m.status))
  const visibleMatches = activeTab === 'upcoming' ? upcomingMatches : pastMatches
  const dayGroups = groupByDay(visibleMatches)

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

  const renderMatchCard = (match: MatchWithTeams) => {
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
          <span className="text-xs text-zinc-500">
            Partido {match.match_number}
            {match.group_letter ? ` · Grupo ${match.group_letter}` : ''}
          </span>
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
  }

  return (
    <div className="space-y-6">
      {/* Member viewer */}
      <MemberViewBar
        members={members}
        currentUserId={currentUserId}
        viewingUserId={viewingUserId}
        loadingMemberId={loadingMemberId}
        onView={viewMember}
        viewedName={viewedMember?.display_name}
      />

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

      {(errorMsg || viewError) && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {errorMsg || viewError}
        </div>
      )}

      {/* Tabs Próximos / Pasados */}
      <div className="flex gap-1">
        <button
          onClick={() => setActiveTab('upcoming')}
          className={clsx(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
            activeTab === 'upcoming'
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
              : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
          )}
        >
          Próximos
          <span className="ml-1.5 text-xs opacity-70">{upcomingMatches.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('past')}
          className={clsx(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
            activeTab === 'past'
              ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/20'
              : 'bg-[#13151c] border border-[#1f2333] text-zinc-400 hover:text-white hover:border-zinc-600'
          )}
        >
          Pasados
          <span className="ml-1.5 text-xs opacity-70">{pastMatches.length}</span>
        </button>
      </div>

      {/* Lista cronológica agrupada por día */}
      <div className="space-y-6">
        {chronologicalMatches.length === 0 && (
          <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-8 text-center text-zinc-500 text-sm">
            No hay partidos cargados. Ejecuta el seed.
          </div>
        )}

        {chronologicalMatches.length > 0 && visibleMatches.length === 0 && (
          <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-8 text-center text-zinc-500 text-sm">
            {activeTab === 'upcoming' ? 'No quedan partidos por jugar.' : 'Aún no hay partidos finalizados.'}
          </div>
        )}

        {dayGroups.map((group) => (
          <div key={group.date} className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 pt-1 first-letter:uppercase">{group.date}</h3>
            {group.matches.map((match) => renderMatchCard(match))}
          </div>
        ))}
      </div>
    </div>
  )
}
