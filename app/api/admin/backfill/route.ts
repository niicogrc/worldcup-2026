import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { backfillAllMatches } from '@/lib/thesportsdb/sync'

// One-shot endpoint: walks every day from the tournament start to today,
// querying TheSportsDB per day (one call/day), and updates every finished match.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await backfillAllMatches()
    return NextResponse.json({ message: 'Backfill completado', details: result })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
