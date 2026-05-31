import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/porras/[id]/join
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: porraId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify porra exists
    const { data: porra, error: porraError } = await (supabase as any)
      .from('porras')
      .select('id, name')
      .eq('id', porraId)
      .single()

    if (porraError || !porra) {
      return NextResponse.json({ error: 'Porra no encontrada' }, { status: 404 })
    }

    // Insert membership (upsert to be safe)
    const { error } = await (supabase as any)
      .from('porra_members')
      .upsert({ porra_id: porraId, user_id: user.id }, { onConflict: 'porra_id,user_id' })

    if (error) throw error
    return NextResponse.json({ id: porra.id, name: porra.name }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
