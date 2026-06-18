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

  // Construye el update solo con los campos presentes en el body. Permite
  // cambiar el rol y/o el Discord ID de forma independiente.
  const update: { role?: UserRole; discord_user_id?: string | null } = {}

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    update.role = body.role
  }

  if (body.discord_user_id !== undefined) {
    const raw = typeof body.discord_user_id === 'string' ? body.discord_user_id.trim() : ''
    if (raw !== '' && !/^\d{17,20}$/.test(raw)) {
      return NextResponse.json(
        { error: 'Discord ID inválido (debe ser el ID numérico, 17-20 dígitos)' },
        { status: 400 },
      )
    }
    update.discord_user_id = raw === '' ? null : raw
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Solo el cambio de ROL del admin está protegido; su Discord ID sí se puede editar.
  if (update.role !== undefined) {
    const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(id)
    if (targetUser?.email === ADMIN_EMAIL) {
      return NextResponse.json({ error: 'No puedes cambiar el rol del administrador' }, { status: 400 })
    }
  }

  const { error } = await (adminClient.from('profiles') as any).update(update).eq('id', id)
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
