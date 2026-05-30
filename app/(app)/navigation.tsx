'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, Calendar, Award, GitMerge, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

interface NavigationProps {
  isMobile?: boolean
  isAdmin?: boolean
}

const links = [
  { href: '/dashboard', label: 'Leaderboard', icon: BarChart2 },
  { href: '/grupos', label: 'Fase de Grupos', icon: Calendar },
  { href: '/playoffs', label: 'Playoffs', icon: GitMerge },
  { href: '/bota-de-oro', label: 'Bota de Oro', icon: Award },
]

export default function Navigation({ isMobile = false, isAdmin = false }: NavigationProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (isMobile) {
    return (
      <>
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors cursor-pointer',
                active ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{label.split(' ')[0]}</span>
            </Link>
          )
        })}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span>Salir</span>
        </button>
      </>
    )
  }

  return (
    <nav className="space-y-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer',
              active
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                : 'text-zinc-400 hover:bg-[#191c26] hover:text-white border border-transparent'
            )}
          >
            <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-blue-400' : 'text-zinc-500')} />
            {label}
          </Link>
        )
      })}

      {isAdmin && (
        <Link
          href="/admin"
          className={clsx(
            'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer mt-2',
            pathname === '/admin'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-zinc-400 hover:bg-[#191c26] hover:text-white border border-transparent'
          )}
        >
          <span className="w-4 h-4 flex-shrink-0 text-center text-xs">⚡</span>
          Admin
        </Link>
      )}

      <div className="pt-4 mt-4 border-t border-[#1f2333]">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-500 hover:bg-red-500/5 hover:text-red-400 border border-transparent transition-all duration-150 cursor-pointer"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </nav>
  )
}
