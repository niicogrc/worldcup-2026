import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { player_name } = body

  if (!player_name?.trim()) {
    return NextResponse.json({ error: 'player_name es requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: predictions, error: fetchError } = await admin
    .from('golden_boot_predictions')
    .select('porra_id, user_id, player_name')

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = (predictions as any[]) ?? []
  const winner = player_name.trim().toLowerCase()

  const db = admin as any

  let awarded = 0
  for (const row of rows) {
    const isCorrect = row.player_name.trim().toLowerCase() === winner
    const { error } = await db
      .from('scores')
      .update({ points_golden_boot: isCorrect ? 15 : 0 })
      .eq('porra_id', row.porra_id)
      .eq('user_id', row.user_id)
    if (!error && isCorrect) awarded++
  }

  return NextResponse.json({ success: true, awarded, total: rows.length })
}
