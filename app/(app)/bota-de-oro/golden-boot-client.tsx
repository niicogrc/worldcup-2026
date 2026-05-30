'use client'

import React, { useState, useEffect } from 'react'
import { clsx } from 'clsx'

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

interface GoldenBootClientProps {
  initialPrediction: GoldenBootPrediction | null
  teams: Team[]
  firstMatchKickoff: string | null
}

export default function GoldenBootClient({ initialPrediction, teams, firstMatchKickoff }: GoldenBootClientProps) {
  const [playerName, setPlayerName] = useState(initialPrediction?.player_name || '')
  const [teamId, setTeamId] = useState(initialPrediction?.team_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const isLocked = timeLeft.isPast

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLocked) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch('/api/golden-boot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, teamId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-2">
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-6">
          {isLocked ? (
            <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg mb-6">
              <span className="text-red-400 text-lg flex-shrink-0">🔒</span>
              <div>
                <p className="text-sm font-semibold text-red-400">Predicción bloqueada</p>
                <p className="text-xs text-zinc-500 mt-0.5">El torneo ya ha comenzado. Las predicciones están cerradas.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg mb-6">
              <span className="text-blue-400 text-lg flex-shrink-0">💡</span>
              <p className="text-xs text-zinc-400">
                Elige al jugador que crees que marcará más goles en el torneo. Si hay empate, cualquiera de los máximos goleadores cuenta como acierto.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="player_name" className="block text-xs font-medium text-zinc-500 mb-1.5">
                Nombre del goleador
              </label>
              <input
                id="player_name"
                type="text"
                disabled={isLocked || saving}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ej: Kylian Mbappé, Erling Haaland..."
                required
                className={clsx(
                  'w-full px-3 py-2.5 bg-[#0c0d12] border rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors',
                  isLocked ? 'border-[#1f2333] opacity-60 cursor-not-allowed' : 'border-[#1f2333] focus:border-blue-500/50'
                )}
              />
            </div>

            <div>
              <label htmlFor="team_select" className="block text-xs font-medium text-zinc-500 mb-1.5">
                Selección (opcional)
              </label>
              <select
                id="team_select"
                disabled={isLocked || saving}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2.5 bg-[#0c0d12] border rounded-lg text-sm text-white focus:outline-none transition-colors',
                  isLocked ? 'border-[#1f2333] opacity-60 cursor-not-allowed' : 'border-[#1f2333] focus:border-blue-500/50'
                )}
              >
                <option value="">Selecciona selección...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.short_code ?? '??'})</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">{error}</div>
            )}
            {success && (
              <div className="px-3 py-2.5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-xs font-medium">
                ✓ Predicción guardada correctamente
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked || saving}
              className={clsx(
                'w-full py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                isLocked
                  ? 'bg-[#1f2333] text-zinc-600 cursor-not-allowed'
                  : saving
                  ? 'bg-amber-400/80 text-zinc-900 cursor-wait'
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
            <p className="text-xs font-medium text-zinc-500 mb-3">Cierra en</p>
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

        {/* Scoring rules */}
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500 mb-3">Puntuación</p>
          <div className="flex items-center justify-between py-2 border-b border-[#1f2333]">
            <span className="text-sm text-zinc-300">Bota de Oro</span>
            <span className="text-sm font-bold text-amber-400">+15 pts</span>
          </div>
          <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
            Si varios jugadores terminan empatados como máximos goleadores, cualquiera de ellos cuenta como acierto.
          </p>
        </div>
      </div>
    </div>
  )
}
