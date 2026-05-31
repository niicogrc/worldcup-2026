'use client'

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus, Users } from 'lucide-react'
import { setActivePorra } from '@/app/actions/porra'
import { clsx } from 'clsx'

type Porra = { id: string; name: string }

interface PorraSelectorProps {
  activePorra: Porra
  allPorras: Porra[]
}

export default function PorraSelector({ activePorra, allPorras }: PorraSelectorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const switchPorra = (porra: Porra) => {
    setOpen(false)
    if (porra.id === activePorra.id) return
    startTransition(async () => {
      await setActivePorra(porra.id)
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={clsx(
          'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-150 cursor-pointer',
          open
            ? 'bg-[#191c26] border-blue-500/30 text-white'
            : 'bg-[#13151c] border-[#1f2333] text-zinc-300 hover:bg-[#191c26] hover:text-white'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base">⚽</span>
          <span className="truncate text-xs">{isPending ? '…' : activePorra.name}</span>
        </div>
        <ChevronDown className={clsx('w-3.5 h-3.5 text-zinc-500 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden z-50 shadow-xl">
          <div className="px-3 py-2 border-b border-[#1f2333]">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Mis porras</p>
          </div>

          {allPorras.map(p => (
            <button
              key={p.id}
              onClick={() => switchPorra(p)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
            >
              <span className="text-sm text-zinc-300 hover:text-white truncate">{p.name}</span>
              {p.id === activePorra.id && <Check className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />}
            </button>
          ))}

          <div className="border-t border-[#1f2333]">
            <button
              onClick={() => { setOpen(false); router.push('/onboarding') }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 hover:text-zinc-300">Unirme a otra porra</span>
            </button>
            <button
              onClick={() => { setOpen(false); router.push('/onboarding?action=create') }}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500 hover:text-zinc-300">Crear nueva porra</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
