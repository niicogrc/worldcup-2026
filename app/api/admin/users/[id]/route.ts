import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin, ADMIN_EMAIL } from '@/lib/admin'

const VALID_ROLES = ['participant', 'admin'] as const
type UserRole = (typeof VALID_ROLES)[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const role: UserRole = body.role

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(id)
  if (targetUser?.email === ADMIN_EMAIL) {
    return NextResponse.json({ error: 'No puedes cambiar el rol del administrador' }, { status: 400 })
  }

  const { error } = await (adminClient.from('profiles') as any).update({ role }).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

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
