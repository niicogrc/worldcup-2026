'use client'

import React, { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { Lock } from 'lucide-react'
import { WORLD_CUP_2026_PLAYERS } from '@/lib/players'
import { getFlagUrl } from '@/lib/flags'

interface Team {
  id: string
  name: string
  short_code: string | null
}

interface GoldenBootPrediction {
  id: string
  player_name: string
  team_id: string | null
  is_locked: boolean
}

interface MemberPick {
  user_id: string
  display_name: string
  player_name: string | null
  team_name: string | null
}

interface GoldenBootClientProps {
  initialPrediction: GoldenBootPrediction | null
  teams: Team[]
  firstMatchKickoff: string | null
  porraId: string
  memberPicks: MemberPick[]
  currentUserId: string
}

export default function GoldenBootClient({ initialPrediction, teams, firstMatchKickoff, porraId, memberPicks, currentUserId }: GoldenBootClientProps) {
  const [query, setQuery] = useState(initialPrediction?.player_name || '')
  const [selectedPlayer, setSelectedPlayer] = useState(initialPrediction?.player_name || '')
  const [teamId, setTeamId] = useState(initialPrediction?.team_id || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true })

  useEffect(() => {
    if (!firstMatchKickoff) return
    const tick = () => {
      const diff = +new Date(firstMatchKickoff) - Date.now()
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true })
        return
      }
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff / 3600000) % 24),
        minutes: Math.floor((diff / 60000) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        isPast: false,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [firstMatchKickoff])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isLocked = timeLeft.isPast

  const filtered = query.trim().length >= 1
    ? WORLD_CUP_2026_PLAYERS
        .filter((p) => p.name.toLowerCase().includes(query.toLowerCase()) || p.teamName.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
    : []

  const handleSelect = (playerName: string, playerTeamName: string) => {
    setQuery(playerName)
    setSelectedPlayer(playerName)
    const team = teams.find((t) => t.name === playerTeamName)
    if (team) setTeamId(team.id)
    setShowDropdown(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setSelectedPlayer('')
    setShowDropdown(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    const nameToSave = selectedPlayer || query.trim()
    if (!nameToSave) return

    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/golden-boot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: nameToSave, teamId, porraId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setSelectedPlayer(nameToSave)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando predicción')
    } finally {
      setSaving(false)
    }
  }

  const selectedTeam = teams.find((t) => t.id === teamId)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-2">
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-6">

          {isLocked ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg mb-6">
              <span className="text-red-400 text-lg shrink-0">🔒</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Predicción bloqueada</p>
                <p className="text-xs text-zinc-500 mt-0.5">El torneo ya ha comenzado.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-400/5 border border-amber-400/15 rounded-lg mb-6">
              <span className="text-amber-400 text-lg shrink-0">🏆</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Busca al jugador que crees que marcará más goles. En caso de empate en goles, cualquiera de los máximos goleadores cuenta como acierto.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Player search */}
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                Jugador candidato a la Bota de Oro
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  disabled={isLocked || saving}
                  value={query}
                  onChange={handleInputChange}
                  onFocus={() => query.trim().length >= 1 && setShowDropdown(true)}
                  placeholder="Busca por nombre o selección..."
                  required
                  autoComplete="off"
                  className={clsx(
                    'w-full px-3 py-2.5 bg-[#0c0d12] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors',
                    isLocked ? 'border-[#1f2333] opacity-60 cursor-not-allowed' : 'border-[#1f2333] focus:border-blue-500/50'
                  )}
                />

                {/* Selected player badge */}
                {selectedPlayer && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="text-[10px] bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">
                      ✓ Seleccionado
                    </span>
                  </div>
                )}

                {/* Dropdown */}
                {showDropdown && filtered.length > 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#13151c] border border-[#1f2333] rounded-lg overflow-hidden shadow-xl"
                  >
                    {filtered.map((player) => {
                      const team = teams.find((t) => t.name === player.teamName)
                      return (
                        <button
                          key={`${player.name}-${player.teamName}`}
                          type="button"
                          onMouseDown={() => handleSelect(player.name, player.teamName)}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#191c26] transition-colors text-left cursor-pointer border-b border-[#1f2333] last:border-0"
                        >
                          <span className="text-sm text-white font-medium">{player.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {getFlagUrl(player.teamName) && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={getFlagUrl(player.teamName)!} alt={player.teamName} className="w-5 h-3.5 object-cover rounded-sm" />
                            )}
                            <span className="text-[10px] font-mono bg-[#1f2333] text-zinc-400 px-1.5 py-0.5 rounded">
                              {team?.short_code ?? player.teamName.substring(0, 3).toUpperCase()}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {showDropdown && query.trim().length >= 1 && filtered.length === 0 && (
                  <div
                    ref={dropdownRef}
                    className="absolute z-50 top-full mt-1 left-0 right-0 bg-[#13151c] border border-[#1f2333] rounded-lg px-3 py-3 text-xs text-zinc-500 shadow-xl"
                  >
                    No hay resultados para &ldquo;{query}&rdquo; — puedes guardarlo igualmente.
                  </div>
                )}
              </div>
              <p className="text-[11px] text-zinc-600 mt-1.5">
                Busca entre {WORLD_CUP_2026_PLAYERS.length} jugadores · Si no aparece, escribe el nombre manualmente.
              </p>
            </div>

            {/* Team display (auto-filled) */}
            {selectedTeam && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#0c0d12] border border-[#1f2333] rounded-lg">
                <span className="text-xs text-zinc-500">Selección:</span>
                {getFlagUrl(selectedTeam.name) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getFlagUrl(selectedTeam.name)!} alt={selectedTeam.name} className="w-6 h-4 object-cover rounded-sm" />
                )}
                <span className="text-xs font-medium text-white">{selectedTeam.name}</span>
                <span className="text-[10px] font-mono bg-[#1f2333] text-zinc-400 px-1.5 py-0.5 rounded ml-auto">
                  {selectedTeam.short_code}
                </span>
              </div>
            )}

            {error && (
              <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">{error}</div>
            )}
            {success && (
              <div className="px-3 py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                ✓ Predicción guardada — {selectedPlayer}
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked || saving || (!selectedPlayer && !query.trim())}
              className={clsx(
                'w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                isLocked
                  ? 'bg-[#1f2333] text-zinc-600 cursor-not-allowed'
                  : saving
                  ? 'bg-amber-400/70 text-zinc-900 cursor-wait'
                  : 'bg-amber-400 hover:bg-amber-300 text-zinc-900'
              )}
            >
              {saving ? 'Guardando...' : isLocked ? 'Predicciones cerradas' : 'Guardar predicción'}
            </button>
          </form>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        {/* Countdown */}
        {!isLocked && firstMatchKickoff && (
          <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
            <p className="text-xs font-medium text-zinc-500 mb-3">Cierre de predicciones</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { v: timeLeft.days, l: 'días' },
                { v: timeLeft.hours, l: 'horas' },
                { v: timeLeft.minutes, l: 'min' },
                { v: timeLeft.seconds, l: 'seg' },
              ].map(({ v, l }) => (
                <div key={l} className="bg-[#0c0d12] rounded-lg p-2.5 border border-[#1f2333]">
                  <div className="text-2xl font-bold tabular-nums text-white">{v}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rules */}
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500 mb-3">Puntuación</p>
          <div className="flex items-center justify-between py-2 border-b border-[#1f2333]">
            <span className="text-sm text-zinc-300">Bota de Oro</span>
            <span className="text-sm font-bold text-amber-400">+15 pts</span>
          </div>
          <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
            Bloqueo automático antes del primer partido del Mundial (11 jun 2026).
          </p>
        </div>

        {/* Member picks */}
        {memberPicks.length > 1 && (
          <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
            <p className="text-xs font-medium text-zinc-500 mb-3">Predicciones de la porra</p>
            <div className="space-y-1">
              {memberPicks.map((m) => {
                const isMe = m.user_id === currentUserId
                return (
                  <div key={m.user_id} className="flex items-center justify-between gap-2 py-2 border-b border-[#1f2333] last:border-0">
                    <span className="text-xs text-zinc-400 truncate">
                      {m.display_name}
                      {isMe && <span className="text-zinc-600"> (tú)</span>}
                    </span>
                    {m.player_name ? (
                      <span className="flex items-center gap-1.5 min-w-0">
                        {m.team_name && getFlagUrl(m.team_name) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getFlagUrl(m.team_name)!} alt={m.team_name} className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                        )}
                        <span className="text-xs font-medium text-white truncate">{m.player_name}</span>
                      </span>
                    ) : !isLocked && !isMe ? (
                      <span className="flex items-center gap-1 text-[11px] text-zinc-600 flex-shrink-0">
                        <Lock className="w-3 h-3" />
                        Oculta
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-600 flex-shrink-0">Sin predicción</span>
                    )}
                  </div>
                )
              })}
            </div>
            {!isLocked && (
              <p className="text-[11px] text-zinc-600 mt-3 leading-relaxed">
                Las predicciones de los demás se revelan al inicio del torneo.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
