import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const admin = createAdminClient()

  const { count, error: countError } = await (admin as any)
    .from('porras')
    .select('id', { count: 'exact', head: true })

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 })
  }

  if ((count ?? 0) <= 1) {
    return NextResponse.json(
      { error: 'No se puede eliminar la última porra. Debe existir al menos una.' },
      { status: 400 }
    )
  }

  // Las tablas relacionadas (porra_members, predictions, golden_boot_predictions, scores)
  // tienen ON DELETE CASCADE, así que basta con borrar la porra.
  const { error } = await (admin as any).from('porras').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
