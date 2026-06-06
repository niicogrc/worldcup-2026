import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { setActivePorra } from '@/app/actions/porra'
import Navigation from './navigation'
import UserMenu from './user-menu'
import MobileHeader from './mobile-header'
import MobileBottomNav from './mobile-bottom-nav'
import PorraSelector from './porra-selector'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let profile: any = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    profile = data
  } catch { /* profile stays null */ }

  const displayName = profile?.display_name || user.email?.split('@')[0] || 'Usuario'
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/thumbs/svg?seed=${displayName}&backgroundColor=1f2333`
  const admin = isAdmin(user.email)

  let activePorra: { id: string; name: string } | null = null
  let porras: { id: string; name: string }[] = []

  try {
    if (admin) {
      const { data: allPorras } = await (supabase as any)
        .from('porras')
        .select('id, name')
        .order('created_at', { ascending: true })
      porras = allPorras ?? []
    } else {
      const { data: memberships } = await (supabase as any)
        .from('porra_members')
        .select('porra_id, porras(id, name)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: true })

      porras = (memberships ?? []).map((m: any) => m.porras).filter(Boolean)

      if (porras.length === 0) redirect('/onboarding')
    }
  } catch (err: any) {
    // If it's a redirect, rethrow it; otherwise fall through with empty porras
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err
    if (!admin) redirect('/onboarding')
  }

  if (porras.length > 0) {
    const cookieStore = await cookies()
    const cookiePorraId = cookieStore.get('active_porra_id')?.value
    activePorra = (cookiePorraId && porras.find(p => p.id === cookiePorraId)) || porras[0]

    if (!cookiePorraId || cookiePorraId !== activePorra!.id) {
      await setActivePorra(activePorra!.id)
    }
  }

  return (
    <div className="flex h-screen bg-[#0c0d12] text-[#e2e6f0] overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#0c0d12] border-r border-[#1f2333] h-full flex-shrink-0">

        {/* Logo + porra selector */}
        <div className="px-4 py-4 border-b border-[#1f2333]">
          <Link href={admin ? '/admin' : '/'} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity mb-3">
            <div>
              <p className="text-white font-bold text-sm leading-tight">Porra Mundial</p>
              <p className={admin ? 'text-amber-500 text-[11px] font-medium' : 'text-zinc-500 text-[11px] font-medium'}>
                {admin ? 'Panel Admin' : 'FIFA 2026'}
              </p>
            </div>
          </Link>
          {activePorra && (
            <PorraSelector activePorra={activePorra} allPorras={porras} />
          )}
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
        <MobileHeader
          displayName={displayName}
          avatarUrl={avatarUrl}
          isAdmin={admin}
          activePorra={activePorra}
          allPorras={porras}
        />

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-8 pb-24 md:pb-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  )
}
