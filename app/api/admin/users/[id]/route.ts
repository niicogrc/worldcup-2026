import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { ADMIN_EMAIL } from '@/lib/admin'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Prevent deleting the admin account itself
  const adminClient = createAdminClient()
  const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(id)
  if (targetUser?.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No puedes eliminar la cuenta de administrador' }, { status: 400 })
  }

  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
