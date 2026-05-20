import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardClient from './leaderboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Get active user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch leaderboard view data
  const { data: leaderboard, error: lbError } = await supabase
    .from('leaderboard')
    .select('*')
    .order('position', { ascending: true })

  if (lbError) {
    console.error('Error fetching leaderboard:', lbError.message)
  }

  // Fetch individual scores breakdown for current user
  const { data: userScore } = await supabase
    .from('scores')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bebas tracking-wider text-slate-100">
            DASHBOARD GENERAL
          </h1>
          <p className="text-sm text-slate-400">
            Clasificación oficial y desglose de puntuaciones en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 text-emerald-400 py-1.5 px-3 rounded-full sporty-badge uppercase">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          En directo via Realtime
        </div>
      </div>

      <LeaderboardClient
        initialLeaderboard={leaderboard || []}
        currentUserId={user.id}
        userScore={userScore}
      />
    </div>
  )
}
