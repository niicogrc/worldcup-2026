'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'

// Preset avatars: DiceBear thumbs with football-related seeds
const PRESET_AVATARS = [
  'mbappe', 'haaland', 'messi', 'ronaldo',
  'vinicius', 'salah', 'kane', 'modric',
  'neymar', 'bellingham', 'pedri', 'gavi',
].map((seed) => ({
  seed,
  url: `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=1e2135&radius=50`,
}))

interface ProfileClientProps {
  initialName: string
  initialAvatarUrl: string
  email: string
}

export default function ProfileClient({ initialName, initialAvatarUrl, email }: ProfileClientProps) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [customUrl, setCustomUrl] = useState(initialAvatarUrl && !initialAvatarUrl.includes('dicebear') ? initialAvatarUrl : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handlePresetSelect = (url: string) => {
    setAvatarUrl(url)
    setCustomUrl('')
  }

  const handleCustomUrlChange = (val: string) => {
    setCustomUrl(val)
    if (val.trim()) setAvatarUrl(val.trim())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, avatarUrl: avatarUrl || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando cambios')
    } finally {
      setSaving(false)
    }
  }

  const previewAvatar = avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${name}&backgroundColor=1e2135&radius=50`

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Avatar preview + picker */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 space-y-5">
        {/* Preview */}
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewAvatar}
            alt="Vista previa"
            className="w-20 h-20 rounded-full bg-[#1f2333] border-2 border-[#2a2f42]"
          />
          <div>
            <p className="text-sm font-semibold text-white">{name || 'Tu nombre'}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{email}</p>
          </div>
        </div>

        {/* Preset grid */}
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2.5">Elige un avatar</p>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_AVATARS.map(({ seed, url }) => (
              <button
                key={seed}
                type="button"
                onClick={() => handlePresetSelect(url)}
                className={clsx(
                  'w-full aspect-square rounded-full overflow-hidden border-2 transition-all cursor-pointer',
                  avatarUrl === url ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-[#1f2333] hover:border-[#2a2f42]'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={seed} className="w-full h-full" />
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
            O pega una URL de imagen
          </label>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => handleCustomUrlChange(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2.5 bg-[#0c0d12] border border-[#1f2333] focus:border-blue-500/50 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Display name */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <label htmlFor="display-name" className="block text-xs font-medium text-zinc-500 mb-1.5">
          Nombre que se muestra en el leaderboard
        </label>
        <input
          id="display-name"
          type="text"
          required
          minLength={2}
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          className="w-full px-3 py-2.5 bg-[#0c0d12] border border-[#1f2333] focus:border-blue-500/50 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none transition-colors"
        />
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm font-medium">
          ✓ Perfil actualizado correctamente
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 bg-[#13151c] border border-[#1f2333] hover:border-[#2a2f42] text-zinc-400 hover:text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
