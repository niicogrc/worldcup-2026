'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'
import { motion } from 'framer-motion'
import { Trophy, Calendar, GitMerge, Award, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
type ScoreRow = Database['public']['Tables']['scores']['Row']

interface LeaderboardClientProps {
  initialLeaderboard: LeaderboardRow[]
  currentUserId: string
  userScore: ScoreRow | null
}

export default function LeaderboardClient({
  initialLeaderboard,
  currentUserId,
  userScore,
}: LeaderboardClientProps) {
  const router = useRouter()
  const supabase = createClient()

  // Realtime subscription to database changes on 'scores' table
  useEffect(() => {
    const channel = supabase
      .channel('scores-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          // Trigger a silent server refresh to update server-fetched data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, router])

  // Find current user's rank row
  const myRankInfo = initialLeaderboard.find((row) => row.user_id === currentUserId)

  // Card Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as const

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100 } },
  } as const

  return (
    <div className="space-y-8">
      {/* Top User Statistics Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants} className="glass-panel p-5 rounded-2xl border-l-4 border-l-emerald-500 relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-emerald-500/10"><Trophy className="w-16 h-16" /></div>
          <p className="text-xs uppercase text-slate-400 font-oswald tracking-wider">Tu Posición</p>
          <p className="text-4xl font-bebas text-slate-100 mt-1">
            {myRankInfo ? `#${myRankInfo.position}` : 'N/A'}
          </p>
          <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bebas block mt-1">
            En el ranking general
          </span>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-panel p-5 rounded-2xl border-l-4 border-l-brand-gold relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-brand-gold/10"><Award className="w-16 h-16" /></div>
          <p className="text-xs uppercase text-slate-400 font-oswald tracking-wider">Puntos Totales</p>
          <p className="text-4xl font-bebas text-slate-100 mt-1">
            {userScore?.total_points ?? 0} <span className="text-lg text-slate-400 font-sans">pts</span>
          </p>
          <span className="text-[10px] text-brand-gold/80 uppercase tracking-widest font-bebas block mt-1">
            Máximo posible: 371 pts
          </span>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-panel p-5 rounded-2xl border-l-4 border-l-brand-blue relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-brand-blue/10"><Calendar className="w-16 h-16" /></div>
          <p className="text-xs uppercase text-slate-400 font-oswald tracking-wider">Fase de Grupos</p>
          <p className="text-4xl font-bebas text-slate-100 mt-1">
            {userScore?.points_group ?? 0} <span className="text-lg text-slate-400 font-sans">pts</span>
          </p>
          <span className="text-[10px] text-brand-blue/80 uppercase tracking-widest font-bebas block mt-1">
            {userScore?.correct_group ?? 0} Aciertos (1-X-2)
          </span>
        </motion.div>

        <motion.div variants={itemVariants} className="glass-panel p-5 rounded-2xl border-l-4 border-l-brand-crimson relative overflow-hidden">
          <div className="absolute right-2 bottom-2 text-brand-crimson/10"><GitMerge className="w-16 h-16" /></div>
          <p className="text-xs uppercase text-slate-400 font-oswald tracking-wider">Playoffs</p>
          <p className="text-4xl font-bebas text-slate-100 mt-1">
            {userScore?.total_points_playoffs ?? 0} <span className="text-lg text-slate-400 font-sans">pts</span>
          </p>
          <span className="text-[10px] text-brand-crimson/80 uppercase tracking-widest font-bebas block mt-1">
            Eliminatorias directas
          </span>
        </motion.div>
      </motion.div>

      {/* Leaderboard Table Container */}
      <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
        <div className="p-6 border-b border-slate-900/60 flex items-center justify-between">
          <h2 className="text-2xl font-bebas tracking-wide text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Tabla de Posiciones
          </h2>
          <div className="text-xs text-slate-400 font-sans max-w-xs text-right hidden sm:block">
            Desempate: 1. Ptos rondas finales | 2. Bota de Oro
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-xs font-oswald uppercase tracking-wider text-slate-400 bg-slate-950/40">
                <th className="py-4 px-6 text-center w-16">Pos</th>
                <th className="py-4 px-6">Jugador</th>
                <th className="py-4 px-6 text-center">Ptos Grupos</th>
                <th className="py-4 px-6 text-center">Ptos Playoffs</th>
                <th className="py-4 px-6 text-center">Bota Oro</th>
                <th className="py-4 px-6 text-center font-semibold text-slate-200">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/50">
              {initialLeaderboard.map((row, index) => {
                const isMe = row.user_id === currentUserId
                
                // Position styling
                let posDisplay: React.ReactNode = row.position
                if (row.position === 1) posDisplay = <span className="text-2xl">🥇</span>
                else if (row.position === 2) posDisplay = <span className="text-2xl">🥈</span>
                else if (row.position === 3) posDisplay = <span className="text-2xl">🥉</span>

                return (
                  <tr
                    key={row.user_id}
                    className={clsx(
                      'transition-colors duration-150',
                      isMe 
                        ? 'bg-emerald-500/5 border-y border-emerald-500/20 text-slate-100 font-medium' 
                        : 'hover:bg-slate-900/20'
                    )}
                  >
                    <td className="py-4 px-6 text-center font-bebas text-lg">
                      {posDisplay}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${row.display_name}`}
                          alt={row.display_name}
                          className={clsx(
                            'w-9 h-9 rounded-full bg-slate-950 border',
                            isMe ? 'border-emerald-400' : 'border-slate-800'
                          )}
                        />
                        <div className="min-w-0">
                          <span className={clsx(
                            'block text-sm truncate',
                            isMe ? 'text-emerald-400 font-semibold' : 'text-slate-200'
                          )}>
                            {row.display_name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] uppercase tracking-widest text-emerald-400/80 font-bebas block -mt-0.5">
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center text-sm font-sans text-slate-300">
                      {row.total_points_groups} pts
                    </td>
                    <td className="py-4 px-6 text-center text-sm font-sans text-slate-300">
                      {row.total_points_playoffs} pts
                    </td>
                    <td className="py-4 px-6 text-center text-sm font-sans">
                      {row.points_golden_boot > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                          +{row.points_golden_boot} pts
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className={clsx(
                      'py-4 px-6 text-center font-bebas text-xl',
                      isMe ? 'text-emerald-400 text-glow-emerald' : 'text-slate-100'
                    )}>
                      {row.total_points}
                    </td>
                  </tr>
                )
              })}

              {initialLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                    No hay ningún participante registrado todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
