import { NextRequest, NextResponse } from 'next/server'
import { syncTodayMatches } from '@/lib/api-football/sync'

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured on the server' }, { status: 500 })
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await syncTodayMatches()
    
    if (!result.success) {
      return NextResponse.json({ 
        message: 'Sync completed with errors', 
        details: result 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Sync completed successfully', 
      details: result 
    }, { status: 200 })

  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 })
  }
}
