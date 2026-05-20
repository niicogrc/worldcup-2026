'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      const origin = window.location.origin
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      })
    } catch (err) {
      console.error('Error logging in:', err)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-slate-950">
      {/* Background glowing rings representing stadium lights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-full max-w-md p-8 rounded-2xl glass-panel relative border border-slate-800/80 z-10"
      >
        {/* Decorative corner highlights */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500 rounded-tl-2xl" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500 rounded-br-2xl" />

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-4 border border-emerald-500/20 text-emerald-400">
            <Trophy className="w-12 h-12" />
          </div>
          <h1 className="text-5xl font-bebas text-slate-100 tracking-wider mb-2">
            PORRA MUNDIAL <span className="text-emerald-400">2026</span>
          </h1>
          <p className="text-slate-400 text-sm font-sans tracking-wide">
            Demuestra que eres el que más sabe de fútbol entre tus amigos.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleOAuthLogin('google')}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-slate-100 rounded-xl font-oswald text-lg uppercase tracking-wider transition-all duration-300 group cursor-pointer"
          >
            {/* Google Icon SVG */}
            <svg
              className="w-5 h-5 text-emerald-400 fill-current group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
            >
              <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.137 4.114-3.5 0-6.35-2.85-6.35-6.35s2.85-6.35 6.35-6.35c1.63 0 3.12.62 4.26 1.76l3.07-3.07C19.25 2.58 15.93 1.25 12.24 1.25 6.3 1.25 1.5 6.05 1.5 12s4.8 10.75 10.74 10.75c6.2 0 10.3-4.36 10.3-10.49 0-.69-.06-1.35-.18-1.975H12.24z"/>
            </svg>
            <span>Acceder con Google</span>
          </button>

          <button
            onClick={() => handleOAuthLogin('github')}
            className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-slate-100 rounded-xl font-oswald text-lg uppercase tracking-wider transition-all duration-300 group cursor-pointer"
          >
            {/* GitHub Icon SVG */}
            <svg
              className="w-5 h-5 text-emerald-400 fill-current group-hover:scale-110 transition-transform"
              viewBox="0 0 24 24"
            >
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            <span>Acceder con GitHub</span>
          </button>
        </div>

        <div className="mt-8 text-center border-t border-slate-900 pt-6">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bebas">
            Fase de grupos ⚡ Playoffs ⚡ Bota de Oro
          </p>
        </div>
      </motion.div>
    </div>
  )
}
