import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/porras/[id]/predictions?userId=<uuid>
// Devuelve las predicciones de un miembro de la porra. La RLS solo expone
// las predicciones de otros usuarios cuyo partido ya ha empezado, así que
// las de partidos futuros nunca salen de la DB.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: porraId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'Falta el parámetro userId' }, { status: 400 })
    }

    // El que consulta debe ser miembro de la porra
    const { data: membership } = await (supabase as any)
      .from('porra_members')
      .select('user_id')
      .eq('porra_id', porraId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'No eres miembro de esta porra' }, { status: 403 })
    }

    const { data, error } = await (supabase as any)
      .from('predictions')
      .select('match_id, prediction, advance_side, is_correct, points_awarded')
      .eq('porra_id', porraId)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
