'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

interface MobileHeaderProps {
  displayName: string
  avatarUrl: string
  isAdmin: boolean
}

const NAV_LINKS = [
  { href: '/',            label: 'Inicio' },
  { href: '/grupos',      label: 'Grupos' },
  { href: '/playoffs',    label: 'Playoffs' },
  { href: '/bota-de-oro', label: 'Bota de Oro' },
  { href: '/dashboard',   label: 'Ranking' },
]

export default function MobileHeader({ displayName, avatarUrl, isAdmin }: MobileHeaderProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    ...NAV_LINKS,
    ...(isAdmin ? [{ href: '/admin', label: '⚡ Admin' }] : []),
  ]

  return (
    <header className="md:hidden flex items-center gap-2 px-3 py-2 bg-[#0c0d12] border-b border-[#1f2333] min-w-0">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-1.5 flex-shrink-0 hover:opacity-80 transition-opacity mr-1">
        <span className="text-base">⚽</span>
        <span className="text-white font-bold text-xs hidden xs:block">Porra</span>
      </Link>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: 'none' }}>
        <div className="flex items-center gap-0.5 w-max">
          {links.map(({ href, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1f2333]'
                )}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Avatar + dropdown */}
      <div ref={menuRef} className="relative flex-shrink-0">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={displayName}
            className={clsx(
              'w-8 h-8 rounded-full bg-[#1f2333] border-2 transition-colors',
              open ? 'border-blue-500' : 'border-transparent'
            )}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-[#191c26] border border-[#2a2f42] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1f2333]">
              <p className="text-sm font-medium text-white truncate">{displayName}</p>
            </div>
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 hover:bg-[#222638] hover:text-white transition-colors"
            >
              <User className="w-4 h-4 text-zinc-500" />
              Editar perfil
            </Link>
            <div className="border-t border-[#1f2333]" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-zinc-500" />
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
