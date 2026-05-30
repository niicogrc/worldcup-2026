import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ProfileClient from './profile-client'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Editar perfil</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Cambia tu nombre y foto de perfil.</p>
      </div>

      <ProfileClient
        initialName={(profile as any)?.display_name || user.email?.split('@')[0] || ''}
        initialAvatarUrl={(profile as any)?.avatar_url || ''}
        email={user.email || ''}
        oauthAvatarUrl={(user.user_metadata?.avatar_url as string) || null}
        oauthProvider={(user.app_metadata?.provider as string) || null}
      />
    </div>
  )
}
