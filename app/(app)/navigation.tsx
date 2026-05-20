'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Calendar, Award, GitMerge, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

interface NavigationProps {
  isMobile?: boolean
  isAdmin?: boolean
}

export default function Navigation({ isMobile = false, isAdmin = false }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const links = [
    { href: '/dashboard', label: 'Leaderboard', icon: Trophy },
    { href: '/grupos', label: 'Fase de Grupos', icon: Calendar },
    { href: '/playoffs', label: 'Playoffs Bracket', icon: GitMerge },
    { href: '/bota-de-oro', label: 'Bota de Oro', icon: Award },
  ]

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      router.refresh()
      router.push('/login')
    } catch (err) {
      console.error('Error signing out:', err)
    }
  }

  if (isMobile) {
    return (
      <>
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 text-[10px] uppercase font-bebas tracking-wider py-1 px-3 rounded-lg transition-colors cursor-pointer',
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{link.label.split(' ')[0]}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center gap-1 text-[10px] uppercase font-bebas tracking-wider py-1 px-3 text-slate-400 hover:text-rose-400 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span>Salir</span>
        </button>
      </>
    )
  }

  return (
    <nav className="space-y-1">
      {links.map((link) => {
        const Icon = link.icon
        const isActive = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-xl font-oswald uppercase tracking-wider text-sm transition-all duration-200 cursor-pointer',
              isActive
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-glow-emerald font-semibold'
                : 'border border-transparent text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
            )}
          >
            <Icon className={clsx('w-4 h-4', isActive ? 'text-emerald-400' : 'text-slate-400')} />
            <span>{link.label}</span>
          </Link>
        )
      })}

      <div className="pt-6 mt-6 border-t border-slate-900/60">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-oswald uppercase tracking-wider text-sm text-slate-400 hover:bg-rose-500/5 hover:text-rose-400 border border-transparent transition-all duration-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </nav>
  )
}
