'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Users, Calendar, Activity, Award, ChevronDown, ChevronUp, Check, X, AlertTriangle, Loader2, Trash2, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  role: 'participant' | 'admin'
  total_points: number
  total_points_groups: number
  total_points_playoffs: number
  points_golden_boot: number
}

interface MatchRow {
  id: string
  phase: string
  match_number: number | null
  group_letter: string | null
  kickoff_at: string
  venue: string | null
  city: string | null
  status: string
  home_goals_ft: number | null
  away_goals_ft: number | null
  home_goals_aet: number | null
  away_goals_aet: number | null
  home_goals_pen: number | null
  away_goals_pen: number | null
  result_ft: string | null
  last_synced_at: string | null
  home_team: { name: string; name_es: string | null; short_code: string | null } | null
  away_team: { name: string; name_es: string | null; short_code: string | null } | null
}

interface SyncLog {
  id: string
  synced_at: string
  matches_updated: number
  matches_checked: number
  api_calls_used: number
  error_message: string | null
  duration_ms: number | null
  triggered_by: string | null
}

interface GoldenBootPrediction {
  id: string
  user_id: string
  player_name: string
  is_locked: boolean
  created_at: string
  display_name: string
  team_name: string | null
}

interface Props {
  users: UserRow[]
  matches: MatchRow[]
  syncLogs: SyncLog[]
  goldenBootPredictions: GoldenBootPrediction[]
  currentUserId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PHASE_ORDER = ['group', 'round_of_32', 'round_of_16', 'quarter_final', 'semi_final', 'third_place', 'final']

const PHASE_LABELS: Record<string, string> = {
  group: 'Fase de Grupos',
  round_of_32: 'Dieciseisavos',
  round_of_16: 'Octavos de Final',
  quarter_final: 'Cuartos de Final',
  semi_final: 'Semifinales',
  third_place: 'Tercer Puesto',
  final: 'Final',
}

const STATUS_OPTIONS = [
  { value: 'NS', label: 'No empezado' },
  { value: '1H', label: '1ª parte' },
  { value: 'HT', label: 'Descanso' },
  { value: '2H', label: '2ª parte' },
  { value: 'ET', label: 'Prórroga' },
  { value: 'P', label: 'Penaltis' },
  { value: 'FT', label: 'Finalizado (90\')' },
  { value: 'AET', label: 'Finalizado (prórroga)' },
  { value: 'PEN', label: 'Finalizado (penaltis)' },
  { value: 'PST', label: 'Aplazado' },
  { value: 'CANC', label: 'Cancelado' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function teamLabel(team: MatchRow['home_team']): string {
  if (!team) return 'TBD'
  return team.name_es ?? team.name
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    NS: 'bg-zinc-700 text-zinc-300',
    '1H': 'bg-green-500/20 text-green-400',
    HT: 'bg-yellow-500/20 text-yellow-400',
    '2H': 'bg-green-500/20 text-green-400',
    ET: 'bg-blue-500/20 text-blue-300',
    P: 'bg-blue-500/20 text-blue-300',
    FT: 'bg-blue-600/20 text-blue-400',
    AET: 'bg-blue-600/20 text-blue-400',
    PEN: 'bg-blue-600/20 text-blue-400',
    PST: 'bg-orange-500/20 text-orange-400',
    CANC: 'bg-red-500/20 text-red-400',
    SUSP: 'bg-red-500/20 text-red-400',
  }
  return map[status] ?? 'bg-zinc-700 text-zinc-300'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Madrid',
  })
}

async function apiFetch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
  return data
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'ok' | 'err' }) {
  return (
    <div className={clsx(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl',
      type === 'ok' ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'
    )}>
      {type === 'ok' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
      {message}
    </div>
  )
}

// ─── Tab: Usuarios ────────────────────────────────────────────────────────────

function TabUsuarios({ users, currentUserId, onToast }: { users: UserRow[]; currentUserId: string; onToast: (msg: string, type: 'ok' | 'err') => void }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null)

  const handleDelete = async (id: string, name: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      onToast(`Usuario "${name}" eliminado`, 'ok')
      setConfirmId(null)
      router.refresh()
    } catch (e: any) {
      onToast(e.message, 'err')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRoleChange = async (id: string, name: string, role: 'participant' | 'admin') => {
    setChangingRoleId(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      onToast(`Rol de "${name}" cambiado a ${role}`, 'ok')
      router.refresh()
    } catch (e: any) {
      onToast(e.message, 'err')
    } finally {
      setChangingRoleId(null)
    }
  }

  return (
    <div>
      <p className="text-zinc-400 text-sm mb-4">{users.length} participantes registrados</p>
      <div className="overflow-x-auto rounded-xl border border-[#1f2333]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2333] text-zinc-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">#</th>
              <th className="text-left px-4 py-3">Usuario</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-right px-4 py-3">Grupos</th>
              <th className="text-right px-4 py-3">Playoffs</th>
              <th className="text-right px-4 py-3">Bota de Oro</th>
              <th className="text-right px-4 py-3 font-bold text-white">Total</th>
              <th className="text-left px-4 py-3">Rol</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className="border-b border-[#1f2333] last:border-0 hover:bg-[#13151c] transition-colors">
                <td className="px-4 py-3 text-zinc-500">{i + 1}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {u.avatar_url && <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full bg-[#1f2333]" />}
                    <span className="text-white font-medium">{u.display_name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{u.total_points_groups}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{u.total_points_playoffs}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{u.points_golden_boot}</td>
                <td className="px-4 py-3 text-right text-blue-400 font-bold text-base">{u.total_points}</td>
                <td className="px-4 py-3">
                  {u.id === currentUserId ? (
                    <span className="text-xs text-zinc-500">—</span>
                  ) : (
                    <div className="relative">
                      {changingRoleId === u.id && (
                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
                          <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                        </div>
                      )}
                      <select
                        value={u.role}
                        disabled={changingRoleId === u.id}
                        onChange={e => handleRoleChange(u.id, u.display_name, e.target.value as 'participant' | 'admin')}
                        className="bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
                      >
                        <option value="participant">Participante</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {confirmId === u.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-zinc-400 text-xs">¿Eliminar?</span>
                      <button
                        onClick={() => handleDelete(u.id, u.display_name)}
                        disabled={deletingId === u.id}
                        className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                      >
                        {deletingId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2.5 py-1 text-zinc-400 hover:text-white text-xs border border-[#2a2f42] rounded-lg transition-colors cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(u.id)}
                      className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Partidos ────────────────────────────────────────────────────────────

function MatchEditRow({ match, onSaved, onError }: { match: MatchRow; onSaved: () => void; onError: (msg: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [homeGoals, setHomeGoals] = useState(match.home_goals_ft?.toString() ?? '')
  const [awayGoals, setAwayGoals] = useState(match.away_goals_ft?.toString() ?? '')
  const [homeAet, setHomeAet] = useState(match.home_goals_aet?.toString() ?? '')
  const [awayAet, setAwayAet] = useState(match.away_goals_aet?.toString() ?? '')
  const [homePen, setHomePen] = useState(match.home_goals_pen?.toString() ?? '')
  const [awayPen, setAwayPen] = useState(match.away_goals_pen?.toString() ?? '')
  const [status, setStatus] = useState(match.status)
  const [saving, setSaving] = useState(false)

  const hasResult = match.result_ft !== null

  const handleSave = async () => {
    setSaving(true)
    try {
      await apiFetch('/api/admin/match-result', {
        match_id: match.id,
        status,
        home_goals_ft: homeGoals === '' ? null : homeGoals,
        away_goals_ft: awayGoals === '' ? null : awayGoals,
        home_goals_aet: homeAet === '' ? null : homeAet,
        away_goals_aet: awayAet === '' ? null : awayAet,
        home_goals_pen: homePen === '' ? null : homePen,
        away_goals_pen: awayPen === '' ? null : awayPen,
      })
      setExpanded(false)
      onSaved()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const scoreDisplay = hasResult
    ? `${match.home_goals_ft} - ${match.away_goals_ft}`
    : '— vs —'

  return (
    <div className="border-b border-[#1f2333] last:border-0">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#13151c] transition-colors text-left"
      >
        <div className="w-6 text-center text-zinc-500 text-xs">{match.match_number ?? '—'}</div>
        <div className="flex-1 grid grid-cols-3 gap-2 items-center">
          <span className="text-zinc-200 text-sm text-right truncate">{teamLabel(match.home_team)}</span>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-white font-mono font-bold text-sm">{scoreDisplay}</span>
            {match.result_ft && (
              <span className="text-[10px] text-zinc-500">1-X-2: {match.result_ft}</span>
            )}
          </div>
          <span className="text-zinc-200 text-sm truncate">{teamLabel(match.away_team)}</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 ml-2">
          <span className="text-zinc-500 text-xs">{fmtDate(match.kickoff_at)}</span>
          <span className={clsx('text-[10px] font-medium px-1.5 py-0.5 rounded-full', statusBadge(match.status))}>
            {match.status}
          </span>
        </div>
        <div className="text-zinc-500 ml-2">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-[#0f1118]">
          <div className="pt-3 flex flex-wrap gap-3 items-end">
            {/* Status */}
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs uppercase">Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500"
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* FT Goals */}
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs uppercase">Goles 90' (local - visitante)</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="20" value={homeGoals} onChange={e => setHomeGoals(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
                <span className="text-zinc-500">–</span>
                <input type="number" min="0" max="20" value={awayGoals} onChange={e => setAwayGoals(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
              </div>
            </div>

            {/* AET Goals */}
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs uppercase">Goles prórroga</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="20" value={homeAet} onChange={e => setHomeAet(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
                <span className="text-zinc-500">–</span>
                <input type="number" min="0" max="20" value={awayAet} onChange={e => setAwayAet(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
              </div>
            </div>

            {/* Pen Goals */}
            <div className="flex flex-col gap-1">
              <label className="text-zinc-500 text-xs uppercase">Penaltis</label>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="20" value={homePen} onChange={e => setHomePen(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
                <span className="text-zinc-500">–</span>
                <input type="number" min="0" max="20" value={awayPen} onChange={e => setAwayPen(e.target.value)}
                  className="w-16 bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 text-center" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-end gap-2 ml-auto">
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-white transition-colors border border-[#2a2f42] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>

          {hasResult && (
            <p className="text-amber-400/70 text-xs mt-3 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Este partido ya tiene resultado. Usa "Recalcular puntos" después de editar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function TabPartidos({ matches, onSaved, onError }: { matches: MatchRow[]; onSaved: () => void; onError: (msg: string) => void }) {
  const [filterPhase, setFilterPhase] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['group']))

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
  }

  const filtered = matches.filter(m => {
    if (filterPhase !== 'all' && m.phase !== filterPhase) return false
    if (filterStatus === 'played' && !m.result_ft) return false
    if (filterStatus === 'pending' && m.result_ft) return false
    return true
  })

  const byPhase = PHASE_ORDER.reduce((acc, phase) => {
    const phaseMatches = filtered.filter(m => m.phase === phase)
    if (phaseMatches.length > 0) acc[phase] = phaseMatches
    return acc
  }, {} as Record<string, MatchRow[]>)

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs uppercase">Fase</label>
          <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)}
            className="bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
            <option value="all">Todas las fases</option>
            {PHASE_ORDER.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-zinc-500 text-xs uppercase">Estado</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-blue-500">
            <option value="all">Todos</option>
            <option value="played">Con resultado</option>
            <option value="pending">Sin resultado</option>
          </select>
        </div>
        <div className="ml-auto flex items-end text-zinc-500 text-xs">
          {filtered.length} partidos
        </div>
      </div>

      {/* Grouped by phase */}
      <div className="space-y-3">
        {Object.entries(byPhase).map(([phase, phaseMatches]) => (
          <div key={phase} className="rounded-xl border border-[#1f2333] overflow-hidden">
            <button
              onClick={() => togglePhase(phase)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#13151c] hover:bg-[#191c26] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">{PHASE_LABELS[phase]}</span>
                <span className="text-zinc-500 text-xs">({phaseMatches.length} partidos)</span>
                <span className="text-zinc-500 text-xs">
                  — {phaseMatches.filter(m => m.result_ft).length} con resultado
                </span>
              </div>
              {expandedPhases.has(phase) ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
            </button>
            {expandedPhases.has(phase) && (
              <div>
                {phaseMatches.map(m => (
                  <MatchEditRow key={m.id} match={m} onSaved={onSaved} onError={onError} />
                ))}
              </div>
            )}
          </div>
        ))}
        {Object.keys(byPhase).length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">Sin partidos con estos filtros</p>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Sync ────────────────────────────────────────────────────────────────

function TabSync({ syncLogs, onToast }: { syncLogs: SyncLog[]; onToast: (msg: string, type: 'ok' | 'err') => void }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const data = await apiFetch('/api/admin/sync', {})
      onToast(`Sync completado · ${data.details?.matchesUpdated ?? 0} partidos actualizados`, 'ok')
      router.refresh()
    } catch (e: any) {
      onToast(e.message, 'err')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar resultados ahora
        </button>
        <p className="text-zinc-500 text-xs">Llama a API-Football y actualiza partidos del día (1 llamada API)</p>
      </div>

      <div className="rounded-xl border border-[#1f2333] overflow-hidden">
        <div className="px-4 py-3 bg-[#13151c] border-b border-[#1f2333]">
          <span className="text-white font-semibold text-sm">Historial de sincronizaciones</span>
          <span className="text-zinc-500 text-xs ml-2">(últimas {syncLogs.length})</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f2333] text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Fecha</th>
                <th className="text-right px-4 py-2.5">Checks</th>
                <th className="text-right px-4 py-2.5">Actualizados</th>
                <th className="text-right px-4 py-2.5">API calls</th>
                <th className="text-right px-4 py-2.5">Duración</th>
                <th className="text-right px-4 py-2.5">Por</th>
                <th className="text-left px-4 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody>
              {syncLogs.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-zinc-500">Sin registros</td></tr>
              )}
              {syncLogs.map(log => (
                <tr key={log.id} className="border-b border-[#1f2333] last:border-0 hover:bg-[#13151c] transition-colors">
                  <td className="px-4 py-2.5 text-zinc-300 text-xs">{fmtDateShort(log.synced_at)}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{log.matches_checked}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={log.matches_updated > 0 ? 'text-green-400 font-medium' : 'text-zinc-500'}>
                      {log.matches_updated}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-400">{log.api_calls_used}</td>
                  <td className="px-4 py-2.5 text-right text-zinc-400 font-mono text-xs">
                    {log.duration_ms != null ? `${log.duration_ms}ms` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right text-zinc-500 text-xs">{log.triggered_by ?? 'cron'}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {log.error_message
                      ? <span className="text-red-400 truncate max-w-[200px] block">{log.error_message}</span>
                      : <span className="text-zinc-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Bota de Oro ─────────────────────────────────────────────────────────

function TabBotaDeOro({ predictions, onToast }: { predictions: GoldenBootPrediction[]; onToast: (msg: string, type: 'ok' | 'err') => void }) {
  const router = useRouter()
  const [winner, setWinner] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSetWinner = async () => {
    if (!winner.trim()) return
    setSaving(true)
    try {
      const data = await apiFetch('/api/admin/golden-boot-winner', { player_name: winner.trim() })
      onToast(`Bota de Oro asignada a ${winner.trim()} · ${data.awarded} acertaron`, 'ok')
      setWinner('')
      router.refresh()
    } catch (e: any) {
      onToast(e.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  const matchCount = predictions.filter(p =>
    p.player_name.trim().toLowerCase() === winner.trim().toLowerCase()
  ).length

  return (
    <div className="space-y-6">
      {/* Winner form */}
      <div className="bg-[#13151c] rounded-xl border border-[#1f2333] p-5">
        <h3 className="text-white font-semibold text-sm mb-1">Establecer ganador de la Bota de Oro</h3>
        <p className="text-zinc-500 text-xs mb-4">Al confirmar, se asignan 15 puntos a las predicciones que coincidan exactamente (sin distinguir mayúsculas).</p>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-zinc-500 text-xs uppercase">Nombre del jugador</label>
            <input
              type="text"
              value={winner}
              onChange={e => setWinner(e.target.value)}
              placeholder="ej. Kylian Mbappé"
              className="bg-[#1f2333] border border-[#2a2f42] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 placeholder-zinc-600"
            />
          </div>
          {winner.trim() && (
            <p className="text-zinc-400 text-xs pb-2">
              {matchCount} predicción{matchCount !== 1 ? 'es' : ''} coincide{matchCount !== 1 ? 'n' : ''}
            </p>
          )}
          <button
            onClick={handleSetWinner}
            disabled={!winner.trim() || saving}
            className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            Asignar puntos
          </button>
        </div>
      </div>

      {/* Predictions list */}
      <div className="rounded-xl border border-[#1f2333] overflow-hidden">
        <div className="px-4 py-3 bg-[#13151c] border-b border-[#1f2333]">
          <span className="text-white font-semibold text-sm">Predicciones</span>
          <span className="text-zinc-500 text-xs ml-2">({predictions.length} usuarios)</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1f2333] text-zinc-500 text-xs uppercase tracking-wide">
              <th className="text-left px-4 py-3">Usuario</th>
              <th className="text-left px-4 py-3">Jugador</th>
              <th className="text-left px-4 py-3">Equipo</th>
              <th className="text-right px-4 py-3">Bloqueada</th>
            </tr>
          </thead>
          <tbody>
            {predictions.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-zinc-500">Sin predicciones</td></tr>
            )}
            {predictions.map(p => {
              const matches = winner.trim() && p.player_name.trim().toLowerCase() === winner.trim().toLowerCase()
              return (
                <tr key={p.id} className={clsx(
                  'border-b border-[#1f2333] last:border-0 transition-colors',
                  matches ? 'bg-amber-500/10' : 'hover:bg-[#13151c]'
                )}>
                  <td className="px-4 py-3 text-white font-medium">{p.display_name}</td>
                  <td className="px-4 py-3 text-zinc-200">
                    {matches && <span className="text-amber-400 mr-1.5">★</span>}
                    {p.player_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.team_name ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {p.is_locked
                      ? <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">Bloqueada</span>
                      : <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">Abierta</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Tab: Stats ───────────────────────────────────────────────────────────────

interface PorraStats {
  id: string
  name: string
  total_members: number
  members_with_all_predictions: number
  members_with_golden_boot: number
  total_predictions: number
  total_possible: number
  completion_pct: number
}

interface GlobalStats {
  total_users: number
  total_predictions: number
  matches_with_result: number
  matches_total: number
}

interface StatsData {
  porras: PorraStats[]
  global: GlobalStats
}

function TabStats({ onToast }: { onToast: (msg: string, type: 'ok' | 'err') => void }) {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(json => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((e: any) => onToast(e.message, 'err'))
      .finally(() => setLoading(false))
  }, [onToast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!data) return null

  const { global, porras } = data

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Usuarios registrados', value: global.total_users },
          { label: 'Predicciones totales', value: global.total_predictions },
          { label: 'Partidos con resultado', value: `${global.matches_with_result} / ${global.matches_total}` },
          { label: 'Partidos restantes', value: global.matches_total - global.matches_with_result },
        ].map(s => (
          <div key={s.label} className="bg-[#13151c] border border-[#1f2333] rounded-xl px-4 py-3">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {porras.map(porra => {
          const fillColor = porra.completion_pct >= 80 ? 'bg-green-500' : 'bg-blue-500'
          return (
            <div key={porra.id} className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold text-sm">{porra.name}</h3>
                <span className="text-zinc-400 text-xs">{porra.total_members} miembros</span>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-zinc-500 text-xs">Completitud de predicciones</span>
                  <span className="text-zinc-300 text-xs font-mono">{porra.completion_pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1f2333] overflow-hidden">
                  <div
                    className={clsx('h-full rounded-full transition-all', fillColor)}
                    style={{ width: `${Math.min(porra.completion_pct, 100)}%` }}
                  />
                </div>
                <p className="text-zinc-600 text-xs mt-1">
                  {porra.total_predictions} de {porra.total_possible} predicciones posibles
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0c0d12] rounded-lg px-3 py-2.5">
                  <p className="text-white font-semibold text-sm">
                    {porra.members_with_all_predictions}
                    <span className="text-zinc-500 font-normal"> / {porra.total_members}</span>
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">Predicciones completas (104)</p>
                </div>
                <div className="bg-[#0c0d12] rounded-lg px-3 py-2.5">
                  <p className="text-white font-semibold text-sm">
                    {porra.members_with_golden_boot}
                    <span className="text-zinc-500 font-normal"> / {porra.total_members}</span>
                  </p>
                  <p className="text-zinc-500 text-xs mt-0.5">Con Bota de Oro</p>
                </div>
              </div>
            </div>
          )
        })}

        {porras.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-8">Sin porras</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'usuarios' | 'partidos' | 'sync' | 'bota' | 'stats'

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'usuarios', label: 'Usuarios', icon: Users },
  { id: 'partidos', label: 'Partidos', icon: Calendar },
  { id: 'sync', label: 'Sync', icon: Activity },
  { id: 'bota', label: 'Bota de Oro', icon: Award },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
]

export default function AdminClient({ users, matches, syncLogs, goldenBootPredictions, currentUserId }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('usuarios')
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'err' } | null>(null)
  const [recalculating, setRecalculating] = useState(false)

  const showToast = (message: string, type: 'ok' | 'err') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleSaved = () => {
    showToast('Partido actualizado. Recuerda recalcular puntos si ya tenía resultado.', 'ok')
    router.refresh()
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const data = await apiFetch('/api/admin/recalculate', {})
      showToast(`Puntos recalculados · ${data.predictionsProcessed} predicciones · ${data.usersUpdated} usuarios`, 'ok')
      router.refresh()
    } catch (e: any) {
      showToast(e.message, 'err')
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Panel de administración</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Control total de la porra</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-400 text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Recalcular puntos
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Participantes', value: users.length },
          { label: 'Partidos total', value: matches.length },
          { label: 'Con resultado', value: matches.filter(m => m.result_ft).length },
          { label: 'Syncs realizados', value: syncLogs.length },
        ].map(s => (
          <div key={s.label} className="bg-[#13151c] border border-[#1f2333] rounded-xl px-4 py-3">
            <p className="text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#1f2333] mb-6 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer border-b-2 -mb-px',
              tab === id
                ? 'text-white border-blue-500'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'usuarios' && <TabUsuarios users={users} currentUserId={currentUserId} onToast={showToast} />}
      {tab === 'partidos' && (
        <TabPartidos
          matches={matches}
          onSaved={handleSaved}
          onError={msg => showToast(msg, 'err')}
        />
      )}
      {tab === 'sync' && <TabSync syncLogs={syncLogs} onToast={showToast} />}
      {tab === 'bota' && <TabBotaDeOro predictions={goldenBootPredictions} onToast={showToast} />}
      {tab === 'stats' && <TabStats onToast={showToast} />}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
