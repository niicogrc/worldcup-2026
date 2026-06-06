'use client'

import React from 'react'
import { AlertCircle } from 'lucide-react'

interface ErrorProps {
  error: Error
  reset: () => void
}

export default function GruposError({ error, reset }: ErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#13151c] border border-[#1f2333]">
        <AlertCircle className="h-8 w-8 text-zinc-700" />
      </div>
      <h2 className="text-lg font-semibold text-zinc-300">No se pudieron cargar los partidos</h2>
      <p className="mt-2 max-w-sm text-sm text-zinc-500">
        Hubo un problema al conectar con la base de datos. Puede que el servicio no esté disponible en este momento.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center rounded-lg bg-[#13151c] border border-[#1f2333] px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-[#191c26] hover:text-white transition-colors"
      >
        Reintentar
      </button>
    </div>
  )
}
