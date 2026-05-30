import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LeaderboardClient from './leaderboard-client'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get admin user_ids from profiles.role (no admin API needed)
  const { data: adminProfiles } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  const adminIds = (adminProfiles ?? []).map((p: any) => p.id)

  // Fetch leaderboard excluding admins
  let query = supabase.from('leaderboard').select('*').order('position', { ascending: true })
  for (const id of adminIds) query = query.neq('user_id', id)
  const { data: leaderboard, error: lbError } = await query

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Clasificación oficial en tiempo real.</p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-[#13151c] border border-[#1f2333] text-blue-400 py-1.5 px-3 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          En directo
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
