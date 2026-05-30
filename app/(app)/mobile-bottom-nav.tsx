'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Calendar, GitMerge, Award, BarChart2 } from 'lucide-react'
import { clsx } from 'clsx'

const TABS = [
  { href: '/',            icon: Home,      label: 'Inicio' },
  { href: '/grupos',      icon: Calendar,  label: 'Grupos' },
  { href: '/playoffs',    icon: GitMerge,  label: 'Playoffs' },
  { href: '/bota-de-oro', icon: Award,     label: 'Bota' },
  { href: '/dashboard',   icon: BarChart2, label: 'Ranking' },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d12] border-t border-[#1f2333]">
      <div className="flex items-center justify-around px-1 py-1 pb-safe">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition-colors',
                active ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon className={clsx('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(96,165,250,0.6)]')} />
              <span className={clsx('text-[10px] font-medium', active ? 'text-blue-400' : 'text-zinc-500')}>
                {label}
              </span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-0.5" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
