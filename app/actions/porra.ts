'use server'

import { cookies } from 'next/headers'

export async function setActivePorra(porraId: string) {
  const cookieStore = await cookies()
  cookieStore.set('active_porra_id', porraId, {
    path: '/',
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
