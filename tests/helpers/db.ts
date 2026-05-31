import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'

const realtimeOpts = { transport: ws } as any

// Service role client — bypasses RLS, used for test setup/teardown and assertions
export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: realtimeOpts,
  })
}

// Anon client authenticated as a specific user (simulates real browser session)
export function userClient(accessToken: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: realtimeOpts,
  })
  client.realtime.setAuth(accessToken)
  // @ts-expect-error — inject token for RLS
  client.rest.headers['Authorization'] = `Bearer ${accessToken}`
  return client
}

export async function createTestUser(
  db: SupabaseClient,
  email: string,
  displayName: string,
): Promise<{ userId: string; accessToken: string }> {
  const password = 'Test1234!'

  // Create auth user
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)

  const userId = created.user.id

  // Ensure profile exists (trigger may have done it, but upsert is safe)
  await db.from('profiles').upsert(
    { id: userId, display_name: displayName },
    { onConflict: 'id', ignoreDuplicates: true },
  )

  // Sign in to get an access token for RLS tests
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, realtime: realtimeOpts },
  )
  const { data: session, error: signInError } = await anonClient.auth.signInWithPassword({ email, password })
  if (signInError) throw new Error(`signIn ${email}: ${signInError.message}`)

  return { userId, accessToken: session.session!.access_token }
}

export async function deleteTestUser(db: SupabaseClient, userId: string) {
  await db.from('porra_members').delete().eq('user_id', userId)
  await db.auth.admin.deleteUser(userId)
}

export async function getFirstMatch(db: SupabaseClient, offset = 0) {
  const { data, error } = await db
    .from('matches')
    .select('id, phase, kickoff_at, status, home_team_id, away_team_id')
    .eq('status', 'NS')
    .order('kickoff_at', { ascending: true })
    .range(offset, offset)

  if (error || !data?.length) throw new Error('No NS match found — run the seed first')
  return data[0]
}
