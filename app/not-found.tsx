import React from 'react'
import Link from 'next/link'
import { SearchX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0c0d12] flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13151c] border border-[#1f2333]">
        <SearchX className="h-8 w-8 text-zinc-700" />
      </div>
      <h1 className="text-2xl font-bold text-zinc-300">Página no encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        La página que buscas no existe o ha sido movida.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
      >
        Ir al leaderboard
      </Link>
    </div>
  )
}
