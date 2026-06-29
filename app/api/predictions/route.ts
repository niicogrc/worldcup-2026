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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureProfile(user.id, user.user_metadata as Record<string, string>)

    const body = await req.json()
    const { matchId, prediction, porraId, advanceSide } = body

    if (!matchId || !['1', 'X', '2'].includes(prediction)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    if (!porraId) {
      return NextResponse.json({ error: 'Falta el id de la porra' }, { status: 400 })
    }
    // advanceSide es opcional (cascada de playoffs): '1' avanza local, '2' visitante.
    // En grupos no se envía. Si llega, debe ser '1' o '2'.
    if (advanceSide != null && !['1', '2'].includes(advanceSide)) {
      return NextResponse.json({ error: 'advanceSide inválido' }, { status: 400 })
    }

    // Verify user is member of this porra
    const { data: membership } = await (supabase as any)
      .from('porra_members')
      .select('porra_id')
      .eq('porra_id', porraId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No eres miembro de esta porra' }, { status: 403 })
    }

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

    const { error: upsertError } = await (supabase.from('predictions') as any)
      .upsert({
        porra_id: porraId,
        user_id: user.id,
        match_id: matchId,
        prediction: prediction,
        advance_side: advanceSide ?? null,
        is_locked: false
      }, { onConflict: 'porra_id,user_id,match_id' })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
