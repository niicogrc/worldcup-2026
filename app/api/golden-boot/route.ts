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

    const { data: firstMatch } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (firstMatch) {
      const kickoff = new Date((firstMatch as any).kickoff_at)
      if (kickoff <= new Date()) {
        return NextResponse.json({ error: 'El torneo ya ha comenzado. Las predicciones de Bota de Oro están cerradas.' }, { status: 400 })
      }
    }

    const body = await req.json()
    const { playerName, teamId, porraId } = body

    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return NextResponse.json({ error: 'Debes introducir el nombre de un jugador' }, { status: 400 })
    }
    if (!porraId) {
      return NextResponse.json({ error: 'Falta el id de la porra' }, { status: 400 })
    }

    // Verify membership
    const { data: membership } = await (supabase as any)
      .from('porra_members')
      .select('porra_id')
      .eq('porra_id', porraId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No eres miembro de esta porra' }, { status: 403 })
    }

    const { data: existing } = await (supabase.from('golden_boot_predictions') as any)
      .select('id')
      .eq('porra_id', porraId)
      .eq('user_id', user.id)
      .maybeSingle()

    let dbError

    if (existing) {
      const { error } = await (supabase.from('golden_boot_predictions') as any)
        .update({
          player_name: playerName.trim(),
          team_id: teamId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', (existing as any).id)
      dbError = error
    } else {
      const { error } = await (supabase.from('golden_boot_predictions') as any)
        .insert({
          porra_id: porraId,
          user_id: user.id,
          player_name: playerName.trim(),
          team_id: teamId || null,
          is_locked: false
        })
      dbError = error
    }

    if (dbError) throw dbError

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
