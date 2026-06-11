import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/porras/[id]/import-predictions
// Copia a la porra [id] las predicciones del usuario en otra porra (sourcePorraId).
// Solo copia predicciones de partidos que aún no han empezado y nunca
// sobrescribe predicciones ya existentes en la porra destino.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: targetPorraId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { sourcePorraId } = await req.json()
    if (!sourcePorraId) {
      return NextResponse.json({ error: 'Falta la porra de origen' }, { status: 400 })
    }
    if (sourcePorraId === targetPorraId) {
      return NextResponse.json({ error: 'La porra de origen y destino no pueden ser la misma' }, { status: 400 })
    }

    // Verify the user is member of both porras
    const { data: memberships } = await (supabase as any)
      .from('porra_members')
      .select('porra_id')
      .eq('user_id', user.id)
      .in('porra_id', [targetPorraId, sourcePorraId])

    const memberOf = new Set((memberships ?? []).map((m: any) => m.porra_id))
    if (!memberOf.has(targetPorraId) || !memberOf.has(sourcePorraId)) {
      return NextResponse.json({ error: 'No eres miembro de ambas porras' }, { status: 403 })
    }

    // Source predictions for this user
    const { data: sourcePreds, error: predsError } = await (supabase as any)
      .from('predictions')
      .select('match_id, prediction')
      .eq('porra_id', sourcePorraId)
      .eq('user_id', user.id)

    if (predsError) throw predsError

    // Only matches that haven't kicked off can be imported
    const now = new Date().toISOString()
    const { data: openMatches, error: matchesError } = await (supabase as any)
      .from('matches')
      .select('id')
      .gt('kickoff_at', now)

    if (matchesError) throw matchesError

    const openIds = new Set((openMatches ?? []).map((m: any) => m.id))
    const importable = (sourcePreds ?? []).filter((p: any) => openIds.has(p.match_id))
    const skippedLocked = (sourcePreds ?? []).length - importable.length

    let importedRows: { match_id: string; prediction: string }[] = []
    if (importable.length > 0) {
      // ON CONFLICT DO NOTHING: las predicciones ya hechas en la porra destino se respetan
      const { data: insertedRows, error: insertError } = await (supabase.from('predictions') as any)
        .upsert(
          importable.map((p: any) => ({
            porra_id: targetPorraId,
            user_id: user.id,
            match_id: p.match_id,
            prediction: p.prediction,
            is_locked: false,
          })),
          { onConflict: 'porra_id,user_id,match_id', ignoreDuplicates: true }
        )
        .select('match_id, prediction')

      if (insertError) throw insertError
      importedRows = insertedRows ?? []
    }

    // Golden Boot: solo si el torneo no ha empezado y no hay ya una en destino
    let goldenBootImported = false
    const { data: firstMatch } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const tournamentStarted = firstMatch && new Date((firstMatch as any).kickoff_at) <= new Date()

    if (!tournamentStarted) {
      const { data: sourceGb } = await (supabase.from('golden_boot_predictions') as any)
        .select('player_name, team_id')
        .eq('porra_id', sourcePorraId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (sourceGb) {
        const { data: insertedGb, error: gbError } = await (supabase.from('golden_boot_predictions') as any)
          .upsert(
            {
              porra_id: targetPorraId,
              user_id: user.id,
              player_name: sourceGb.player_name,
              team_id: sourceGb.team_id,
              is_locked: false,
            },
            { onConflict: 'porra_id,user_id', ignoreDuplicates: true }
          )
          .select('id')

        if (gbError) throw gbError
        goldenBootImported = (insertedGb?.length ?? 0) > 0
      }
    }

    return NextResponse.json(
      { imported: importedRows.length, predictions: importedRows, skippedLocked, goldenBootImported },
      { status: 200 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
