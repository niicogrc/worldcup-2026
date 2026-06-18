import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  // Dos vías de auth: (1) cron/CI con Bearer CRON_SECRET, (2) sesión de admin (panel)
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const admin = createAdminClient() as any

  // Recálculo completo y ATÓMICO en una sola transacción (función Postgres
  // recompute_all_scores). Si falla, hace rollback y los scores quedan
  // intactos — nunca se quedan a 0 ni parcialmente recompuestos.
  const { error } = await admin.rpc('recompute_all_scores')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
