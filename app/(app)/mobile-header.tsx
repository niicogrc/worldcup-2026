'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut, Shield } from 'lucide-react'
import { clsx } from 'clsx'

interface MobileHeaderProps {
  displayName: string
  avatarUrl: string
  isAdmin: boolean
}

export default function MobileHeader({ displayName, avatarUrl, isAdmin }: MobileHeaderProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0c0d12] border-b border-[#1f2333]">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
        <span className="text-lg">⚽</span>
        <span className="text-white font-bold text-sm">Porra 2026</span>
      </Link>

      {/* Avatar + dropdown */}
      <div ref={menuRef} className="relative">
        <button onClick={() => setOpen(v => !v)} className="cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt={displayName}
            className={clsx(
              'w-9 h-9 rounded-full bg-[#1f2333] border-2 transition-colors',
              open ? 'border-blue-500' : 'border-transparent'
            )}
          />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-[#191c26] border border-[#2a2f42] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1f2333]">
              <p className="text-sm font-semibold text-white truncate">{displayName}</p>
            </div>
            <Link
              href="/perfil"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-[#222638] hover:text-white transition-colors"
            >
              <User className="w-4 h-4 text-zinc-500" />
              Editar perfil
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Panel admin
              </Link>
            )}
            <div className="border-t border-[#1f2333]" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-zinc-300 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
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
