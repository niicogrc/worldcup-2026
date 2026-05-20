import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Trophy, Calendar, Award, GitMerge, LogOut, Shield } from 'lucide-react'
import Link from 'next/link'

// We'll write a client component for navigation and signout, and render it here
import Navigation from './navigation'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // Get user session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const displayName = (profile as any)?.display_name || user.email?.split('@')[0] || 'Usuario'
  const avatarUrl = (profile as any)?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${displayName}`
  const isAdmin = (profile as any)?.role === 'admin'

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel border-r border-slate-900 h-full">
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-900/60 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bebas tracking-wider text-slate-100">
              PORRA MUNDIAL
            </h1>
            <p className="text-xs text-slate-500 font-sans tracking-widest uppercase">
              FIFA 2026
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 px-4 py-6 overflow-y-auto">
          <Navigation isAdmin={isAdmin} />
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-900/60 flex items-center justify-between gap-3 bg-slate-950/40">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate text-slate-200">
                {displayName}
              </p>
              <p className="text-xs text-slate-500 truncate flex items-center gap-1 uppercase tracking-wider font-oswald">
                {isAdmin ? (
                  <>
                    <Shield className="w-3 h-3 text-emerald-400" />
                    Admin
                  </>
                ) : (
                  'Participante'
                )}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-slate-950/80 backdrop-blur-md border-b border-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <span className="text-xl font-bebas tracking-wider">PORRA 2026</span>
          </div>

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full border border-slate-800"
            />
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </main>

        {/* Mobile Navigation bar */}
        <nav className="md:hidden flex items-center justify-around p-3 bg-slate-950 border-t border-slate-900 z-20">
          <Navigation isMobile isAdmin={isAdmin} />
        </nav>
      </div>
    </div>
  )
}
