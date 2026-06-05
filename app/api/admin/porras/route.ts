import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: porras, error: porrasError } = await (admin as any)
    .from('porras')
    .select('id, name, created_at, created_by')
    .order('created_at', { ascending: true })

  if (porrasError) {
    return NextResponse.json({ error: porrasError.message }, { status: 500 })
  }

  const { data: members, error: membersError } = await (admin as any)
    .from('porra_members')
    .select('porra_id, user_id, profiles:user_id(id, display_name)')

  if (membersError) {
    return NextResponse.json({ error: membersError.message }, { status: 500 })
  }

  const authUsersRes = await admin.auth.admin.listUsers({ perPage: 500 })
  const emailMap = new Map(
    (authUsersRes.data?.users ?? []).map((u: any) => [u.id, u.email ?? ''])
  )

  const membersByPorra = new Map<string, { id: string; display_name: string; email: string }[]>()
  for (const m of (members ?? [])) {
    const profile = m.profiles as any
    if (!profile) continue
    const list = membersByPorra.get(m.porra_id) ?? []
    list.push({
      id: profile.id,
      display_name: profile.display_name ?? '—',
      email: (emailMap.get(profile.id) as string) ?? '',
    })
    membersByPorra.set(m.porra_id, list)
  }

  const result = (porras ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    created_at: p.created_at,
    member_count: (membersByPorra.get(p.id) ?? []).length,
    members: membersByPorra.get(p.id) ?? [],
  }))

  return NextResponse.json(result)
}
