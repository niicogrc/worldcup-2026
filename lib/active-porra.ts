import { cookies } from 'next/headers'

export async function getActivePorraId(
  supabase: any,
  userId: string,
  isAdminUser: boolean = false
): Promise<string | null> {
  const cookieStore = await cookies()
  const cookiePorraId = cookieStore.get('active_porra_id')?.value

  if (isAdminUser) {
    // Admin can access any porra — validate the cookie porra exists, else use the first one
    if (cookiePorraId) {
      const { data } = await supabase.from('porras').select('id').eq('id', cookiePorraId).maybeSingle()
      if (data) return cookiePorraId
    }
    const { data: first } = await supabase.from('porras').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle()
    return first?.id ?? null
  }

  // Regular user: validate against their porra memberships
  const { data: memberships } = await supabase
    .from('porra_members')
    .select('porra_id')
    .eq('user_id', userId)

  const memberPorraIds: string[] = (memberships ?? []).map((m: any) => m.porra_id)
  if (memberPorraIds.length === 0) return null

  if (cookiePorraId && memberPorraIds.includes(cookiePorraId)) return cookiePorraId
  return memberPorraIds[0]
}
