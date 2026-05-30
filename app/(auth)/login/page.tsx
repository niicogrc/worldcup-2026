'use client'

import React from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      const origin = window.location.origin
      await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${origin}/auth/callback` },
      })
    } catch (err) {
      console.error('Error logging in:', err)
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0d12] flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-blue-600 p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}
        />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <span className="text-2xl">⚽</span>
            <span className="text-white font-bold text-xl tracking-tight">Porra Mundial 2026</span>
          </div>

          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            La porra definitiva del Mundial
          </h2>
          <p className="text-blue-100 text-lg leading-relaxed">
            Predice resultados, gana puntos y demuestra que sabes más de fútbol que tus amigos.
          </p>
        </div>

        {/* Stats */}
        <div className="relative grid grid-cols-3 gap-4">
          {[
            { value: '104', label: 'Partidos' },
            { value: '48', label: 'Equipos' },
            { value: '371', label: 'Puntos máx.' },
          ].map((s) => (
            <div key={s.label} className="bg-white/10 rounded-xl p-4 text-center">
              <div className="text-white text-2xl font-bold">{s.value}</div>
              <div className="text-blue-100 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-10">
            <span className="text-2xl">⚽</span>
            <span className="text-white font-bold text-xl">Porra Mundial 2026</span>
          </div>

          <h1 className="text-2xl font-bold text-white mb-1">Acceder</h1>
          <p className="text-zinc-400 text-sm mb-8">Usa tu cuenta de Google o GitHub para entrar.</p>

          <div className="space-y-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#13151c] border border-[#1f2333] hover:border-blue-500/40 hover:bg-[#191c26] text-white rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>

            <button
              onClick={() => handleOAuthLogin('github')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#13151c] border border-[#1f2333] hover:border-blue-500/40 hover:bg-[#191c26] text-white rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0 fill-white" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
              </svg>
              Continuar con GitHub
            </button>
          </div>

          <p className="text-zinc-600 text-xs text-center mt-8">
            Solo para participantes invitados · FIFA World Cup 2026
          </p>
        </div>
      </div>
    </div>
  )
}
