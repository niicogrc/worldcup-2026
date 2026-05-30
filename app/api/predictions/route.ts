import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function ensureProfile(userId: string, userMeta: Record<string, string>) {
  const admin = createAdminClient()
  const displayName = userMeta['full_name'] || userMeta['name'] || userMeta['email']?.split('@')[0] || 'Usuario'
  const avatarUrl = userMeta['avatar_url'] || null
  await (admin.from('profiles') as any).upsert(
    { id: userId, display_name: displayName, avatar_url: avatarUrl },
    { onConflict: 'id', ignoreDuplicates: true }
  )
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure profile exists (guard for users who registered before the trigger was in place)
    await ensureProfile(user.id, user.user_metadata as Record<string, string>)

    // 2. Parse request
    const body = await req.json()
    const { matchId, prediction } = body

    if (!matchId || !['1', 'X', '2'].includes(prediction)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // 3. Check if match is locked (kickoff is in the past)
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    const kickoff = new Date((match as any).kickoff_at)
    if (kickoff <= new Date()) {
      return NextResponse.json({ error: 'Las predicciones para este partido ya están cerradas' }, { status: 400 })
    }

    // 4. Upsert prediction
    const { error: upsertError } = await (supabase.from('predictions') as any)
      .upsert({
        user_id: user.id,
        match_id: matchId,
        prediction: prediction,
        is_locked: false
      }, { onConflict: 'user_id,match_id' })

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
