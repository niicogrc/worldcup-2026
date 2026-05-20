import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // 2. Determine if predictions are locked (first match kickoff is in the past)
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

    // 3. Parse and validate body
    const body = await req.json()
    const { playerName, teamId } = body

    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return NextResponse.json({ error: 'Debes introducir el nombre de un jugador' }, { status: 400 })
    }

    // 4. Query current prediction to insert or update
    const { data: existing } = await (supabase.from('golden_boot_predictions') as any)
      .select('id')
      .eq('user_id', user.id)
      .single()

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
          user_id: user.id,
          player_name: playerName.trim(),
          team_id: teamId || null,
          is_locked: false
        })
      dbError = error
    }

    if (dbError) {
      throw dbError
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
