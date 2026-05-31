import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser } from './helpers/db'

const db = adminClient()

let aliceId: string
let bobId: string
let porraAId: string
let porraBId: string

beforeAll(async () => {
  const alice = await createTestUser(db, 'test-alice4@porra.test', 'Alice GB')
  const bob   = await createTestUser(db, 'test-bob4@porra.test',   'Bob GB')
  aliceId = alice.userId
  bobId   = bob.userId

  const { data: pa } = await db.from('porras')
    .insert({ name: '[TEST] Porra GB A', created_by: aliceId })
    .select('id').single()
  porraAId = pa.id
  await db.from('porra_members').insert({ porra_id: porraAId, user_id: bobId })

  const { data: pb } = await db.from('porras')
    .insert({ name: '[TEST] Porra GB B', created_by: bobId })
    .select('id').single()
  porraBId = pb.id
})

afterAll(async () => {
  await db.from('golden_boot_predictions').delete().in('porra_id', [porraAId, porraBId])
  await db.from('porras').delete().in('id', [porraAId, porraBId])
  await deleteTestUser(db, aliceId)
  await deleteTestUser(db, bobId)
})

describe('Bota de Oro — predicciones independientes por porra', () => {

  it('Alice elige a Messi como Bota de Oro en Porra A', async () => {
    const { error } = await db.from('golden_boot_predictions').insert({
      porra_id:    porraAId,
      user_id:     aliceId,
      player_name: 'Lionel Messi',
      is_locked:   false,
    })
    expect(error).toBeNull()
  })

  it('Bob elige a Vinicius en Porra A (mismo jugador prohibido, otro usuario OK)', async () => {
    const { error } = await db.from('golden_boot_predictions').insert({
      porra_id:    porraAId,
      user_id:     bobId,
      player_name: 'Vinicius Jr.',
      is_locked:   false,
    })
    expect(error).toBeNull()
  })

  it('Alice no puede votar dos veces en la misma porra (unique constraint)', async () => {
    const { error } = await db.from('golden_boot_predictions').insert({
      porra_id:    porraAId,
      user_id:     aliceId,
      player_name: 'Kylian Mbappé',
      is_locked:   false,
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/duplicate|unique/i)
  })

  it('Bob puede elegir un jugador diferente en Porra B (porras independientes)', async () => {
    const { error } = await db.from('golden_boot_predictions').insert({
      porra_id:    porraBId,
      user_id:     bobId,
      player_name: 'Erling Haaland',
      is_locked:   false,
    })
    expect(error).toBeNull()
  })

  it('Porra A tiene 2 predicciones, Porra B tiene 1', async () => {
    const { data: pa } = await db.from('golden_boot_predictions')
      .select('player_name').eq('porra_id', porraAId)
    const { data: pb } = await db.from('golden_boot_predictions')
      .select('player_name').eq('porra_id', porraBId)

    expect(pa).toHaveLength(2)
    expect(pb).toHaveLength(1)
    expect(pb![0].player_name).toBe('Erling Haaland')
  })

  it('La predicción de Bob en Porra A no afecta a Porra B', async () => {
    const { data } = await db.from('golden_boot_predictions')
      .select('porra_id, player_name')
      .eq('user_id', bobId)

    const porraAEntry = data!.find(r => r.porra_id === porraAId)!
    const porraBEntry = data!.find(r => r.porra_id === porraBId)!

    expect(porraAEntry.player_name).toBe('Vinicius Jr.')
    expect(porraBEntry.player_name).toBe('Erling Haaland')
  })
})
