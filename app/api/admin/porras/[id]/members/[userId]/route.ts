import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: porraId, userId } = await params
  const admin = createAdminClient()

  // Guard: no dejar la porra sin miembros (mínimo 1)
  const { count, error: countError } = await (admin as any)
    .from('porra_members')
    .select('id', { count: 'exact', head: true })
    .eq('porra_id', porraId)

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: 'No se puede expulsar al último miembro de la porra.' },
      { status: 400 }
    )
  }

  const { error } = await (admin as any)
    .from('porra_members')
    .delete()
    .eq('porra_id', porraId)
    .eq('user_id', userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
