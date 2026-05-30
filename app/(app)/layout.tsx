import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import Navigation from './navigation'
import UserMenu from './user-menu'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const displayName = (profile as any)?.display_name || user.email?.split('@')[0] || 'Usuario'
  const avatarUrl = (profile as any)?.avatar_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${displayName}&backgroundColor=1f2333`
  const admin = isAdmin(user.email)

  return (
    <div className="flex h-screen bg-[#0c0d12] text-[#e2e6f0] overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0c0d12] border-r border-[#1f2333] h-full flex-shrink-0">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1f2333]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚽</span>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Porra Mundial</p>
              <p className="text-zinc-500 text-[11px] font-medium">FIFA 2026</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <Navigation isAdmin={admin} />
        </div>

        {/* User menu */}
        <UserMenu displayName={displayName} avatarUrl={avatarUrl} isAdmin={admin} />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0c0d12] border-b border-[#1f2333]">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚽</span>
            <span className="text-white font-bold text-sm">Porra 2026</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full bg-[#1f2333]" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile Nav */}
        <nav className="md:hidden flex items-center justify-around px-2 py-2 bg-[#0c0d12] border-t border-[#1f2333]">
          <Navigation isMobile isAdmin={admin} />
        </nav>
      </div>
    </div>
  )
}
