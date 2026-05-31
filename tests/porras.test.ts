import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser } from './helpers/db'

// ─── Test state ───────────────────────────────────────────────────────────────
const db = adminClient()
let aliceId: string
let bobId: string
let porraId: string

beforeAll(async () => {
  const alice = await createTestUser(db, 'test-alice@porra.test', 'Alice Test')
  const bob   = await createTestUser(db, 'test-bob@porra.test',   'Bob Test')
  aliceId = alice.userId
  bobId   = bob.userId
})

afterAll(async () => {
  // Limpieza: eliminar porra (cascade borra members + scores)
  if (porraId) await db.from('porras').delete().eq('id', porraId)
  await deleteTestUser(db, aliceId)
  await deleteTestUser(db, bobId)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Porras — crear y gestionar grupos', () => {

  it('Alice crea una porra', async () => {
    const { data, error } = await db
      .from('porras')
      .insert({ name: '[TEST] Porra de los amigos', created_by: aliceId })
      .select('id, name, created_by')
      .single()

    expect(error).toBeNull()
    expect(data.name).toBe('[TEST] Porra de los amigos')
    expect(data.created_by).toBe(aliceId)
    porraId = data.id
  })

  it('El trigger añade a Alice como miembro automáticamente al crear la porra', async () => {
    const { data, error } = await db
      .from('porra_members')
      .select('user_id')
      .eq('porra_id', porraId)

    expect(error).toBeNull()
    expect(data?.map(m => m.user_id)).toContain(aliceId)
  })

  it('El trigger crea una fila en scores para Alice al hacerse miembro', async () => {
    const { data, error } = await db
      .from('scores')
      .select('porra_id, user_id, total_points')
      .eq('porra_id', porraId)
      .eq('user_id', aliceId)
      .single()

    expect(error).toBeNull()
    expect(data.total_points).toBe(0)
  })

  it('Bob se une a la porra', async () => {
    const { error } = await db
      .from('porra_members')
      .insert({ porra_id: porraId, user_id: bobId })

    expect(error).toBeNull()
  })

  it('Bob también tiene fila en scores al unirse', async () => {
    const { data, error } = await db
      .from('scores')
      .select('user_id, total_points')
      .eq('porra_id', porraId)
      .eq('user_id', bobId)
      .single()

    expect(error).toBeNull()
    expect(data.total_points).toBe(0)
  })

  it('La porra tiene exactamente 2 miembros', async () => {
    const { data, error } = await db
      .from('porra_members')
      .select('user_id')
      .eq('porra_id', porraId)

    expect(error).toBeNull()
    expect(data).toHaveLength(2)
  })

  it('No se puede unir el mismo usuario dos veces (unique constraint)', async () => {
    const { error } = await db
      .from('porra_members')
      .insert({ porra_id: porraId, user_id: aliceId })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/duplicate|unique/i)
  })

  it('Bob puede abandonar la porra', async () => {
    const { error } = await db
      .from('porra_members')
      .delete()
      .eq('porra_id', porraId)
      .eq('user_id', bobId)

    expect(error).toBeNull()

    const { data } = await db
      .from('porra_members')
      .select('user_id')
      .eq('porra_id', porraId)

    expect(data?.map(m => m.user_id)).not.toContain(bobId)
  })
})
