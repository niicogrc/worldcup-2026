import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Sync OAuth avatar to profile on first login (if profile has no avatar yet)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const oauthAvatar = user.user_metadata?.avatar_url as string | undefined
        if (oauthAvatar) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single()
          if (!(profile as any)?.avatar_url) {
            await (supabase as any)
              .from('profiles')
              .update({ avatar_url: oauthAvatar })
              .eq('id', user.id)
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`)
}
