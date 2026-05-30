'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, LogOut, ChevronUp } from 'lucide-react'
import { clsx } from 'clsx'

interface UserMenuProps {
  displayName: string
  avatarUrl: string
  isAdmin: boolean
}

export default function UserMenu({ displayName, avatarUrl, isAdmin }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div ref={ref} className="relative px-3 py-3 border-t border-[#1f2333]">
      {/* Dropdown menu — opens upward */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-[#191c26] border border-[#2a2f42] rounded-xl overflow-hidden shadow-xl z-50">
          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 hover:bg-[#222638] hover:text-white transition-colors cursor-pointer"
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

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors cursor-pointer',
          open ? 'bg-[#191c26]' : 'hover:bg-[#191c26]'
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full bg-[#1f2333] flex-shrink-0" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-white truncate">{displayName}</p>
          <p className="text-[11px] text-zinc-500 truncate">{isAdmin ? '⚡ Admin' : 'Participante'}</p>
        </div>
        <ChevronUp className={clsx('w-3.5 h-3.5 text-zinc-600 flex-shrink-0 transition-transform', open ? 'rotate-0' : 'rotate-180')} />
      </button>
    </div>
  )
}
