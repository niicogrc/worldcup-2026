import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { syncTodayMatches } from '@/lib/thesportsdb/sync'

// One-shot endpoint: fetches ALL tournament fixtures from TheSportsDB in a single call
// and updates every finished match in the DB (no date filter = full backfill).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Pass no date → getWorldCupFixtures() fetches all season fixtures in one call (TheSportsDB)
    const result = await syncTodayMatches(undefined)
    return NextResponse.json({ message: 'Backfill completado', details: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
