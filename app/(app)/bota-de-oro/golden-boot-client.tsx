'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Award, ShieldAlert, Sparkles, Check } from 'lucide-react'
import { clsx } from 'clsx'

interface Team {
  id: string
  name: string
  short_code: string | null
  flag_url: string | null
}

interface GoldenBootPrediction {
  id: string
  player_name: string
  team_id: string | null
  is_locked: boolean
  team?: {
    id: string
    name: string
    flag_url: string | null
  } | null
}

interface GoldenBootClientProps {
  initialPrediction: GoldenBootPrediction | null
  teams: Team[]
  firstMatchKickoff: string | null
}

export default function GoldenBootClient({
  initialPrediction,
  teams,
  firstMatchKickoff,
}: GoldenBootClientProps) {
  const [playerName, setPlayerName] = useState(initialPrediction?.player_name || '')
  const [teamId, setTeamId] = useState(initialPrediction?.team_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number
    hours: number
    minutes: number
    seconds: number
    isPast: boolean
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true })

  const isLocked = timeLeft.isPast

  // Countdown timer logic
  useEffect(() => {
    if (!firstMatchKickoff) return

    const calculateTime = () => {
      const difference = +new Date(firstMatchKickoff) - +new Date()
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true })
        return
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isPast: false,
      })
    }

    calculateTime()
    const timer = setInterval(calculateTime, 1000)

    return () => clearInterval(timer)
  }, [firstMatchKickoff])

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
        throw new Error(data.error || 'Failed to save prediction')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Error guardando predicción')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Input Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel p-6 md:p-8 rounded-2xl border border-slate-900 relative">
          <h2 className="text-2xl font-bebas tracking-wide text-slate-100 mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-gold" />
            Tu Candidato
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="player_name" className="block text-xs uppercase tracking-wider text-slate-400 font-oswald">
                Nombre del Goleador
              </label>
              <input
                id="player_name"
                type="text"
                disabled={isLocked || saving}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ej. Kylian Mbappé, Erling Haaland..."
                required
                className={clsx(
                  'w-full px-4 py-3 bg-slate-950 border border-slate-905 text-slate-100 rounded-xl font-sans focus:outline-none transition-colors duration-200',
                  isLocked ? 'opacity-70 cursor-not-allowed' : 'focus:border-emerald-500/50'
                )}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="team_select" className="block text-xs uppercase tracking-wider text-slate-400 font-oswald">
                Selección Nacional del Jugador
              </label>
              <select
                id="team_select"
                disabled={isLocked || saving}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className={clsx(
                  'w-full px-4 py-3 bg-slate-950 border border-slate-905 text-slate-100 rounded-xl font-sans focus:outline-none transition-colors duration-200 cursor-pointer',
                  isLocked ? 'opacity-70 cursor-not-allowed' : 'focus:border-emerald-500/50'
                )}
              >
                <option value="">Selecciona selección (opcional)...</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.short_code || '??'})
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-sans">
                {error}
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 font-sans animate-fade-in">
                <Check className="w-4 h-4" /> Predicción guardada con éxito
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked || saving}
              className={clsx(
                'w-full py-4 rounded-xl font-oswald text-lg uppercase tracking-wider transition-all duration-300 relative cursor-pointer',
                isLocked
                  ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-brand-gold text-slate-950 font-bold hover:shadow-[0_0_20px_rgba(212,175,55,0.2)]'
              )}
            >
              {saving ? 'Guardando...' : isLocked ? 'Predicciones Cerradas' : 'Guardar Predicción'}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Info & Countdown */}
      <div className="space-y-6">
        {/* Countdown card */}
        {!isLocked && firstMatchKickoff && (
          <div className="glass-panel p-6 rounded-2xl border border-slate-900 bg-slate-950/20 relative overflow-hidden">
            <div className="absolute right-2 bottom-2 text-emerald-500/5"><Sparkles className="w-24 h-24" /></div>
            
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-oswald mb-4">
              Cierre de Predicciones
            </h3>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900">
                <span className="block font-bebas text-3xl text-emerald-400">{timeLeft.days}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bebas">Días</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900">
                <span className="block font-bebas text-3xl text-emerald-400">{timeLeft.hours}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bebas">Hrs</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900">
                <span className="block font-bebas text-3xl text-emerald-400">{timeLeft.minutes}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bebas">Min</span>
              </div>
              <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-900">
                <span className="block font-bebas text-3xl text-emerald-400">{timeLeft.seconds}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bebas">Seg</span>
              </div>
            </div>
            
            <p className="text-[10px] text-slate-500 font-sans mt-4 text-center italic">
              Bloqueo automático al inicio del primer partido del Mundial 2026.
            </p>
          </div>
        )}

        {isLocked && (
          <div className="glass-panel p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02] flex items-start gap-4">
            <ShieldAlert className="w-8 h-8 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-oswald uppercase tracking-wider text-rose-400">Predicción Bloqueada</h3>
              <p className="text-xs text-slate-400 font-sans mt-1">
                El Mundial de Fútbol 2026 ya ha comenzado y las predicciones para la Bota de Oro están cerradas para todos los participantes.
              </p>
            </div>
          </div>
        )}

        {/* Scoring description card */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-900">
          <h3 className="text-xs uppercase tracking-wider text-slate-400 font-oswald mb-3">
            Reglas de Puntuación
          </h3>
          <p className="text-sm text-slate-300 font-sans leading-relaxed">
            Acertar al máximo goleador del torneo otorga <strong className="text-brand-gold font-semibold">+15 puntos adicionales</strong> en la clasificación general.
          </p>
          <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-900 text-xs text-slate-400 font-sans">
            ⚽ En caso de empate en la bota de oro (varios goleadores con el mismo número de goles), cualquier participante que haya elegido a uno de ellos se considerará acierto.
          </div>
        </div>
      </div>
    </div>
  )
}
