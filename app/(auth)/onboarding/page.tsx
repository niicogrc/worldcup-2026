'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Users, ChevronDown, Check, Loader2, Download } from 'lucide-react'
import { setActivePorra } from '@/app/actions/porra'
import { clsx } from 'clsx'

type Porra = {
  id: string
  name: string
  profiles: { display_name: string } | null
}

type Step = 'choice' | 'join' | 'create'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('choice')

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('action') === 'create') {
      setStep('create')
    }
  }, [])
  const [porras, setPorras] = useState<Porra[]>([])
  const [myPorras, setMyPorras] = useState<Porra[]>([])
  const [selectedPorra, setSelectedPorra] = useState<Porra | null>(null)
  const [importFrom, setImportFrom] = useState<Porra | null>(null)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [importDropdownOpen, setImportDropdownOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/porras')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setPorras(data)
      })
    fetch('/api/porras?mine=true')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMyPorras(data)
      })
  }, [])

  const handleJoin = () => {
    if (!selectedPorra) return
    setError('')
    startTransition(async () => {
      const res = await fetch(`/api/porras/${selectedPorra.id}/join`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Error al unirse')
        return
      }
      await setActivePorra(selectedPorra.id)
      router.push('/')
    })
  }

  const handleCreate = () => {
    if (newName.trim().length < 2) {
      setError('El nombre debe tener al menos 2 caracteres')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await fetch('/api/porras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al crear')
        return
      }
      if (importFrom) {
        // La porra ya está creada: si la importación falla, seguimos igualmente
        await fetch(`/api/porras/${data.id}/import-predictions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePorraId: importFrom.id }),
        }).catch(() => {})
      }
      await setActivePorra(data.id)
      router.push('/')
    })
  }

  return (
    <div className="min-h-screen bg-[#0c0d12] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-10">
          <span className="text-2xl">⚽</span>
          <div className="text-center">
            <p className="text-white font-bold text-lg leading-tight">Porra Mundial 2026</p>
          </div>
        </div>

        {step === 'choice' && (
          <div className="space-y-4">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white">¿Qué quieres hacer?</h1>
              <p className="text-zinc-400 text-sm mt-2">Puedes unirte a una porra existente o crear una nueva.</p>
            </div>

            <button
              onClick={() => setStep('join')}
              className="w-full flex items-center gap-4 p-5 bg-[#13151c] border border-[#1f2333] hover:border-blue-500/40 hover:bg-[#191c26] rounded-xl transition-all duration-200 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Unirme a una porra existente</p>
                <p className="text-zinc-500 text-xs mt-0.5">Elige entre las porras disponibles</p>
              </div>
            </button>

            <button
              onClick={() => setStep('create')}
              className="w-full flex items-center gap-4 p-5 bg-[#13151c] border border-[#1f2333] hover:border-blue-500/40 hover:bg-[#191c26] rounded-xl transition-all duration-200 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Plus className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Crear una porra nueva</p>
                <p className="text-zinc-500 text-xs mt-0.5">Invita a tus amigos a tu propia porra</p>
              </div>
            </button>
          </div>
        )}

        {step === 'join' && (
          <div className="space-y-4">
            <div className="mb-6">
              <button
                onClick={() => { setStep('choice'); setError(''); setSelectedPorra(null) }}
                className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors cursor-pointer"
              >
                ← Volver
              </button>
              <h1 className="text-2xl font-bold text-white">Unirme a una porra</h1>
              <p className="text-zinc-400 text-sm mt-1">Elige la porra a la que quieres unirte.</p>
            </div>

            {/* Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className={clsx(
                  'w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#13151c] border rounded-xl text-sm transition-all duration-200 cursor-pointer',
                  dropdownOpen ? 'border-blue-500/60' : 'border-[#1f2333] hover:border-[#2a2f42]'
                )}
              >
                <span className={selectedPorra ? 'text-white' : 'text-zinc-500'}>
                  {selectedPorra ? selectedPorra.name : 'Selecciona una porra…'}
                </span>
                <ChevronDown className={clsx('w-4 h-4 text-zinc-500 transition-transform', dropdownOpen && 'rotate-180')} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden z-10 shadow-xl max-h-64 overflow-y-auto">
                  {porras.length === 0 ? (
                    <div className="px-4 py-3 text-zinc-500 text-sm">No hay porras disponibles aún</div>
                  ) : (
                    porras.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setSelectedPorra(p); setDropdownOpen(false) }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">{p.name}</p>
                          {p.profiles?.display_name && (
                            <p className="text-zinc-500 text-xs">Creada por {p.profiles.display_name}</p>
                          )}
                        </div>
                        {selectedPorra?.id === p.id && <Check className="w-4 h-4 text-blue-400" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleJoin}
              disabled={!selectedPorra || isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Unirme
            </button>
          </div>
        )}

        {step === 'create' && (
          <div className="space-y-4">
            <div className="mb-6">
              <button
                onClick={() => { setStep('choice'); setError(''); setNewName(''); setImportFrom(null) }}
                className="text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors cursor-pointer"
              >
                ← Volver
              </button>
              <h1 className="text-2xl font-bold text-white">Crear nueva porra</h1>
              <p className="text-zinc-400 text-sm mt-1">Dale un nombre. Podrás compartirla con tus amigos.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Nombre de la porra</label>
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="Ej: Porra Oficina 2026"
                autoFocus
                className="w-full px-4 py-3 bg-[#13151c] border border-[#1f2333] focus:border-blue-500/60 outline-none text-white placeholder-zinc-600 rounded-xl text-sm transition-colors"
              />
            </div>

            {myPorras.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Importar predicciones de otra porra <span className="text-zinc-600">(opcional)</span>
                </label>
                <div className="relative">
                  <button
                    onClick={() => setImportDropdownOpen(o => !o)}
                    className={clsx(
                      'w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#13151c] border rounded-xl text-sm transition-all duration-200 cursor-pointer',
                      importDropdownOpen ? 'border-blue-500/60' : 'border-[#1f2333] hover:border-[#2a2f42]'
                    )}
                  >
                    <span className={clsx('flex items-center gap-2', importFrom ? 'text-white' : 'text-zinc-500')}>
                      <Download className="w-4 h-4 text-zinc-500" />
                      {importFrom ? importFrom.name : 'No importar nada'}
                    </span>
                    <ChevronDown className={clsx('w-4 h-4 text-zinc-500 transition-transform', importDropdownOpen && 'rotate-180')} />
                  </button>

                  {importDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#13151c] border border-[#1f2333] rounded-xl overflow-hidden z-10 shadow-xl max-h-64 overflow-y-auto">
                      <button
                        onClick={() => { setImportFrom(null); setImportDropdownOpen(false) }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
                      >
                        <p className="text-zinc-400 text-sm">No importar nada</p>
                        {!importFrom && <Check className="w-4 h-4 text-blue-400" />}
                      </button>
                      {myPorras.map(p => (
                        <button
                          key={p.id}
                          onClick={() => { setImportFrom(p); setImportDropdownOpen(false) }}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#191c26] transition-colors text-left cursor-pointer"
                        >
                          <p className="text-white text-sm font-medium">{p.name}</p>
                          {importFrom?.id === p.id && <Check className="w-4 h-4 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-zinc-600 text-xs mt-1.5">
                  Se copiarán tus pronósticos de partidos que aún no hayan empezado y tu Bota de Oro.
                </p>
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleCreate}
              disabled={newName.trim().length < 2 || isPending}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Crear porra
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
