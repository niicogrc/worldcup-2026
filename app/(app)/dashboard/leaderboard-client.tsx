'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/lib/supabase/types'
import { clsx } from 'clsx'

type LeaderboardRow = Database['public']['Views']['leaderboard']['Row']
type ScoreRow = Database['public']['Tables']['scores']['Row']

interface MatchHistoryEntry {
  pts: number
  ok: boolean
}

interface LeaderboardClientProps {
  initialLeaderboard: LeaderboardRow[]
  currentUserId: string
  userScore: ScoreRow | null
  historyByUser: Record<string, MatchHistoryEntry[]>
}

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

function MatchHistory({ history }: { history: MatchHistoryEntry[] }) {
  if (!history || history.length === 0) {
    return <span className="text-zinc-600 text-xs">—</span>
  }
  return (
    <div className="flex items-center justify-center gap-1">
      {history.map((h, i) => (
        <span
          key={i}
          title={h.ok ? `Acierto · +${h.pts}` : 'Fallo'}
          className={clsx(
            'inline-flex items-center justify-center w-6 h-6 rounded text-[11px] font-bold tabular-nums',
            h.ok
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
              : 'bg-red-500/15 text-red-400 border border-red-500/25'
          )}
        >
          {h.pts}
        </span>
      ))}
    </div>
  )
}

export default function LeaderboardClient({ initialLeaderboard, currentUserId, userScore, historyByUser }: LeaderboardClientProps) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('scores-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, router])

  const myRank = initialLeaderboard.find((r) => r.user_id === currentUserId)

  const statCards = [
    { label: 'Tu posición', value: myRank ? `#${myRank.position}` : '—', sub: 'en el ranking', color: 'text-blue-400' },
    { label: 'Puntos totales', value: String(userScore?.total_points ?? 0), sub: 'de 371 posibles', color: 'text-white' },
    { label: 'Fase de grupos', value: String(userScore?.points_group ?? 0), sub: `${userScore?.correct_group ?? 0} aciertos`, color: 'text-white' },
    { label: 'Playoffs', value: String(userScore?.total_points_playoffs ?? 0), sub: 'puntos eliminatoria', color: 'text-white' },
  ]

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="bg-[#13151c] border border-[#1f2333] rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">{s.label}</p>
            <p className={clsx('text-3xl font-bold tabular-nums', s.color)}>{s.value}</p>
            <p className="text-xs text-zinc-600 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f2333]">
          <h2 className="text-base font-semibold text-white">Clasificación general</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Desempate: 1. Pts rondas finales · 2. Bota de Oro · 3. Sorteo</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-zinc-500 border-b border-[#1f2333]">
                <th className="py-3 px-5 text-center w-14">Pos</th>
                <th className="py-3 px-4 text-left">Jugador</th>
                <th className="py-3 px-4 text-center hidden md:table-cell">Últimos 5</th>
                <th className="py-3 px-4 text-center hidden sm:table-cell">Grupos</th>
                <th className="py-3 px-4 text-center hidden sm:table-cell">Playoffs</th>
                <th className="py-3 px-4 text-center hidden sm:table-cell">Bota</th>
                <th className="py-3 px-5 text-center font-semibold text-zinc-300">Total</th>
              </tr>
            </thead>
            <tbody>
              {initialLeaderboard.map((row) => {
                const isMe = row.user_id === currentUserId
                return (
                  <tr
                    key={row.user_id}
                    onClick={() => router.push(isMe ? '/grupos' : `/grupos?member=${row.user_id}`)}
                    title={isMe ? 'Ver tus predicciones' : `Ver las predicciones de ${row.display_name}`}
                    className={clsx(
                      'border-b border-[#1f2333] last:border-0 transition-colors cursor-pointer',
                      isMe ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-[#191c26]'
                    )}
                  >
                    <td className="py-3 px-5 text-center">
                      {MEDALS[row.position] ? (
                        <span className="text-lg">{MEDALS[row.position]}</span>
                      ) : (
                        <span className={clsx('text-sm tabular-nums', isMe ? 'text-blue-400 font-bold' : 'text-zinc-400')}>{row.position}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={row.avatar_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${row.display_name}&backgroundColor=1f2333`}
                          alt={row.display_name}
                          className={clsx('w-8 h-8 rounded-full bg-[#1f2333] flex-shrink-0', isMe ? 'ring-1 ring-blue-400' : '')}
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={clsx('text-sm font-medium', isMe ? 'text-blue-400' : 'text-white')}>{row.display_name}</span>
                          {isMe && <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded font-medium">Tú</span>}
                          {!isMe && (
                            <Link
                              href={`/comparar?a=${currentUserId}&b=${row.user_id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] text-zinc-500 hover:text-blue-400 transition-colors border border-[#1f2333] hover:border-blue-500/30 px-1.5 py-0.5 rounded font-medium"
                            >
                              vs
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <MatchHistory history={historyByUser[row.user_id] ?? []} />
                    </td>
                    <td className="py-3 px-4 text-center text-zinc-300 tabular-nums hidden sm:table-cell">{row.total_points_groups}</td>
                    <td className="py-3 px-4 text-center text-zinc-300 tabular-nums hidden sm:table-cell">{row.total_points_playoffs}</td>
                    <td className="py-3 px-4 text-center hidden sm:table-cell">
                      {row.points_golden_boot > 0 ? (
                        <span className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded-full font-medium">+{row.points_golden_boot}</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className={clsx('py-3 px-5 text-center text-lg font-bold tabular-nums', isMe ? 'text-blue-400' : 'text-white')}>
                      {row.total_points}
                    </td>
                  </tr>
                )
              })}

              {initialLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500 text-sm">
                    Aún no hay participantes registrados.
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
