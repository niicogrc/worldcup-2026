import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser, getFirstMatch } from './helpers/db'

const db = adminClient()

let aliceId: string
let bobId: string
let charlieId: string
let porraAId: string   // porra con Alice + Bob
let porraBId: string   // porra solo con Charlie (aislamiento)
let matchId: string

beforeAll(async () => {
  const alice   = await createTestUser(db, 'test-alice2@porra.test',   'Alice Pred')
  const bob     = await createTestUser(db, 'test-bob2@porra.test',     'Bob Pred')
  const charlie = await createTestUser(db, 'test-charlie@porra.test',  'Charlie Pred')
  aliceId   = alice.userId
  bobId     = bob.userId
  charlieId = charlie.userId

  // Porra A: Alice + Bob
  const { data: pa } = await db.from('porras')
    .insert({ name: '[TEST] Porra A', created_by: aliceId })
    .select('id').single()
  porraAId = pa.id
  await db.from('porra_members').insert({ porra_id: porraAId, user_id: bobId })

  // Porra B: solo Charlie
  const { data: pb } = await db.from('porras')
    .insert({ name: '[TEST] Porra B', created_by: charlieId })
    .select('id').single()
  porraBId = pb.id

  // Primer partido NS disponible
  const match = await getFirstMatch(db)
  matchId = match.id
})

afterAll(async () => {
  await db.from('predictions').delete().in('porra_id', [porraAId, porraBId])
  await db.from('porras').delete().in('id', [porraAId, porraBId])
  await deleteTestUser(db, aliceId)
  await deleteTestUser(db, bobId)
  await deleteTestUser(db, charlieId)
})

describe('Predicciones — sistema 1-X-2 por porra', () => {

  it('Alice predice "1" en Porra A', async () => {
    const { error } = await db.from('predictions').insert({
      porra_id:   porraAId,
      user_id:    aliceId,
      match_id:   matchId,
      prediction: '1',
    })
    expect(error).toBeNull()
  })

  it('Bob predice "X" en Porra A (mismo partido, misma porra, distinto usuario)', async () => {
    const { error } = await db.from('predictions').insert({
      porra_id:   porraAId,
      user_id:    bobId,
      match_id:   matchId,
      prediction: 'X',
    })
    expect(error).toBeNull()
  })

  it('Charlie predice "2" en Porra B (mismo partido, porra distinta)', async () => {
    const { error } = await db.from('predictions').insert({
      porra_id:   porraBId,
      user_id:    charlieId,
      match_id:   matchId,
      prediction: '2',
    })
    expect(error).toBeNull()
  })

  it('No se puede predecir dos veces el mismo partido en la misma porra (unique constraint)', async () => {
    const { error } = await db.from('predictions').insert({
      porra_id:   porraAId,
      user_id:    aliceId,
      match_id:   matchId,
      prediction: '2',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/duplicate|unique/i)
  })

  it('Sí se puede actualizar la predicción de Alice en Porra A', async () => {
    const { error } = await db.from('predictions')
      .update({ prediction: 'X' })
      .eq('porra_id', porraAId)
      .eq('user_id',  aliceId)
      .eq('match_id', matchId)
    expect(error).toBeNull()

    const { data } = await db.from('predictions')
      .select('prediction')
      .eq('porra_id', porraAId)
      .eq('user_id',  aliceId)
      .eq('match_id', matchId)
      .single()
    expect(data?.prediction).toBe('X')
  })

  it('Las predicciones de Porra B son invisibles para consultas de Porra A', async () => {
    const { data } = await db.from('predictions')
      .select('user_id, prediction')
      .eq('porra_id', porraAId)
      .eq('match_id', matchId)

    const userIds = data?.map(p => p.user_id) ?? []
    expect(userIds).toContain(aliceId)
    expect(userIds).toContain(bobId)
    expect(userIds).not.toContain(charlieId)
  })

  it('Porra B solo ve la predicción de Charlie', async () => {
    const { data } = await db.from('predictions')
      .select('user_id, prediction')
      .eq('porra_id', porraBId)
      .eq('match_id', matchId)

    expect(data).toHaveLength(1)
    expect(data![0].user_id).toBe(charlieId)
    expect(data![0].prediction).toBe('2')
  })
})
