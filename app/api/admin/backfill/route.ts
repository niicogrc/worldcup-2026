import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { syncTodayMatches } from '@/lib/api-football/sync'

// One-shot endpoint: fetches ALL tournament fixtures from API-Football (not just today)
// and updates every finished match in the DB. Uses 1 API call.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Pass no date → getFixtures() fetches all season fixtures in one call
    const result = await syncTodayMatches(undefined)
    return NextResponse.json({ message: 'Backfill completado', details: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
