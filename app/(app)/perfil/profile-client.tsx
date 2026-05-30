'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { Upload, Camera } from 'lucide-react'

const PRESET_AVATARS = [
  'mbappe', 'haaland', 'messi', 'ronaldo',
  'vinicius', 'salah', 'kane', 'modric',
  'neymar', 'bellingham', 'pedri', 'gavi',
].map((seed) => `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=1e2135&radius=50`)

interface ProfileClientProps {
  initialName: string
  initialAvatarUrl: string
  email: string
  oauthAvatarUrl: string | null
  oauthProvider: string | null
}

export default function ProfileClient({ initialName, initialAvatarUrl, email, oauthAvatarUrl, oauthProvider }: ProfileClientProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(initialName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede superar 2 MB')
      return
    }
    setError(null)
    setPendingFile(file)
    setLocalPreview(URL.createObjectURL(file))
  }

  const handlePresetSelect = (url: string) => {
    setAvatarUrl(url)
    setLocalPreview(null)
    setPendingFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      let finalAvatarUrl = avatarUrl

      // Upload new file if selected
      if (pendingFile) {
        const fd = new FormData()
        fd.append('file', pendingFile)
        const uploadRes = await fetch('/api/profile/avatar', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          const data = await uploadRes.json()
          throw new Error(data.error || 'Error subiendo imagen')
        }
        const { url } = await uploadRes.json()
        finalAvatarUrl = url
      }

      // Update profile
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, avatarUrl: finalAvatarUrl }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      setAvatarUrl(finalAvatarUrl)
      setPendingFile(null)
      setLocalPreview(null)
      setSuccess(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error guardando cambios')
    } finally {
      setSaving(false)
    }
  }

  const displayPreview = localPreview || avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${name}&backgroundColor=1e2135&radius=50`

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Current avatar + upload button */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <p className="text-xs font-medium text-zinc-500 mb-4">Foto de perfil</p>

        <div className="flex items-start gap-5">
          {/* Preview */}
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayPreview}
              alt="Avatar"
              className="w-20 h-20 rounded-full bg-[#1f2333] border-2 border-[#2a2f42] object-cover"
            />
            {pendingFile && (
              <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">✓</span>
            )}
          </div>

          <div className="space-y-2 flex-1">
            <div>
              <p className="text-sm font-medium text-white">{name || 'Tu nombre'}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{email}</p>
            </div>

            {/* OAuth avatar button — uses the real photo from the current session */}
            {oauthAvatarUrl && (
              <button
                type="button"
                onClick={() => { setAvatarUrl(oauthAvatarUrl); setLocalPreview(null); setPendingFile(null) }}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer border',
                  (!localPreview && avatarUrl === oauthAvatarUrl)
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : 'bg-[#1f2333] border-[#2a2f42] hover:bg-[#2a2f42] text-zinc-300 hover:text-white'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={oauthAvatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                Usar foto de {oauthProvider === 'github' ? 'GitHub' : 'Google'}
              </button>
            )}

            {/* File upload button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-[#1f2333] hover:bg-[#2a2f42] border border-[#2a2f42] hover:border-[#3a3f52] rounded-lg text-sm text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              {pendingFile ? pendingFile.name.substring(0, 24) + (pendingFile.name.length > 24 ? '…' : '') : 'Subir foto desde el PC'}
            </button>
            <p className="text-[11px] text-zinc-600">JPG, PNG o WebP · máx. 2 MB</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Preset avatars */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <p className="text-xs font-medium text-zinc-500 mb-3">O elige un avatar generado</p>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => handlePresetSelect(url)}
              title={url.match(/seed=([^&]+)/)?.[1]}
              className={clsx(
                'aspect-square rounded-full overflow-hidden border-2 transition-all cursor-pointer',
                !localPreview && avatarUrl === url
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-[#1f2333] hover:border-[#2a2f42]'
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full" />
            </button>
          ))}
        </div>
      </div>

      {/* Display name */}
      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5">
        <label htmlFor="display-name" className="block text-xs font-medium text-zinc-500 mb-1.5">
          Nombre en el leaderboard
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
          ✓ Perfil actualizado
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Upload className="w-4 h-4 animate-bounce" />
              {pendingFile ? 'Subiendo...' : 'Guardando...'}
            </>
          ) : 'Guardar cambios'}
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
