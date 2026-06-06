import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ADMIN_EMAIL } from '@/lib/admin'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`)
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`)
    }

    const { data } = await supabase.auth.getUser()
    const user = data?.user

    if (user) {
      const db = supabase as any

      try {
        const { data: profile } = await db
          .from('profiles')
          .select('avatar_url, role')
          .eq('id', user.id)
          .maybeSingle()

        const updates: Record<string, unknown> = {}

        const oauthAvatar = user.user_metadata?.avatar_url as string | undefined
        if (oauthAvatar && !profile?.avatar_url) {
          updates.avatar_url = oauthAvatar
        }

        if (user.email === ADMIN_EMAIL && profile?.role !== 'admin') {
          updates.role = 'admin'
        }

        if (Object.keys(updates).length > 0) {
          await db.from('profiles').update(updates).eq('id', user.id)
        }
      } catch {
        // Profile update is best-effort; continue with redirect
      }

      if (user.email === ADMIN_EMAIL) {
        return NextResponse.redirect(`${origin}/admin`)
      }

      try {
        const { data: memberships } = await db
          .from('porra_members')
          .select('porra_id')
          .eq('user_id', user.id)
          .limit(1)

        if (!memberships || memberships.length === 0) {
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      } catch {
        // If porra_members table doesn't exist yet, send to onboarding
        return NextResponse.redirect(`${origin}/onboarding`)
      }
    }

    return NextResponse.redirect(`${origin}${next}`)
  } catch {
    return NextResponse.redirect(`${origin}/login?error=auth-code-exchange-failed`)
  }
}
