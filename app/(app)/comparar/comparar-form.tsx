'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

interface User {
  user_id: string
  display_name: string
  avatar_url: string | null
}

interface CompararFormProps {
  users: User[]
  currentUserId: string
}

export default function CompararForm({ users, currentUserId }: CompararFormProps) {
  const router = useRouter()
  const [a, setA] = useState(currentUserId)
  const [b, setB] = useState(users.find(u => u.user_id !== currentUserId)?.user_id ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!a || !b || a === b) return
    router.push(`/comparar?a=${a}&b=${b}`)
  }

  return (
    <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-6 max-w-md mx-auto">
      <h2 className="text-base font-semibold text-white mb-1">Selecciona dos participantes</h2>
      <p className="text-xs text-zinc-500 mb-5">Compara las predicciones y puntos de cualquier par de jugadores.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 block">Jugador A</label>
          <select
            value={a}
            onChange={e => setA(e.target.value)}
            className="w-full bg-[#0c0d12] border border-[#1f2333] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            {users.map(u => (
              <option key={u.user_id} value={u.user_id}>
                {u.display_name}{u.user_id === currentUserId ? ' (Tú)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center">
          <div className="h-px flex-1 bg-[#1f2333]" />
          <span className="mx-3 text-zinc-600 text-xs font-medium">vs</span>
          <div className="h-px flex-1 bg-[#1f2333]" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-400 block">Jugador B</label>
          <select
            value={b}
            onChange={e => setB(e.target.value)}
            className="w-full bg-[#0c0d12] border border-[#1f2333] text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500/50 cursor-pointer"
          >
            <option value="">-- Elige un jugador --</option>
            {users.map(u => (
              <option key={u.user_id} value={u.user_id} disabled={u.user_id === a}>
                {u.display_name}{u.user_id === currentUserId ? ' (Tú)' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={!a || !b || a === b}
          className={clsx(
            'w-full py-2.5 rounded-lg text-sm font-semibold transition-all duration-150',
            a && b && a !== b
              ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
              : 'bg-[#1f2333] text-zinc-600 cursor-not-allowed'
          )}
        >
          Comparar
        </button>
      </form>
    </div>
  )
}
