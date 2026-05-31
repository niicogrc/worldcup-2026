import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser, getFirstMatch } from './helpers/db'

/**
 * Este test simula el flujo completo de puntuación:
 * 1. Tres usuarios en la misma porra predicen un partido
 * 2. Forzamos el resultado del partido via admin UPDATE
 * 3. El trigger award_points_on_result distribuye puntos
 * 4. Verificamos el leaderboard
 *
 * IMPORTANTE: se usa un partido NS real de la DB y se restaura su estado
 * al finalizar para no corromper los datos de producción.
 */

const db = adminClient()

let aliceId: string
let bobId: string
let charlieId: string
let porraId: string
let matchId: string
let originalMatchStatus: string

beforeAll(async () => {
  const alice   = await createTestUser(db, 'test-alice3@porra.test',   'Alice LB')
  const bob     = await createTestUser(db, 'test-bob3@porra.test',     'Bob LB')
  const charlie = await createTestUser(db, 'test-charlie3@porra.test', 'Charlie LB')
  aliceId   = alice.userId
  bobId     = bob.userId
  charlieId = charlie.userId

  // Una porra con los 3 usuarios
  const { data: p } = await db.from('porras')
    .insert({ name: '[TEST] Porra Leaderboard', created_by: aliceId })
    .select('id').single()
  porraId = p.id
  await db.from('porra_members').insert([
    { porra_id: porraId, user_id: bobId },
    { porra_id: porraId, user_id: charlieId },
  ])

  // Partido de prueba — usamos el segundo para no colisionar con predictions.test.ts
  const match = await getFirstMatch(db, 1)
  matchId = match.id
  originalMatchStatus = match.status

  // Alice → '1', Bob → '1', Charlie → '2'
  await db.from('predictions').insert([
    { porra_id: porraId, user_id: aliceId,   match_id: matchId, prediction: '1' },
    { porra_id: porraId, user_id: bobId,     match_id: matchId, prediction: '1' },
    { porra_id: porraId, user_id: charlieId, match_id: matchId, prediction: '2' },
  ])
})

afterAll(async () => {
  // Restaurar estado original del partido
  await db.from('matches').update({
    status:        originalMatchStatus,
    home_goals_ft: null,
    away_goals_ft: null,
    result_ft:     null,
    last_synced_at: null,
  }).eq('id', matchId)


  // Limpiar datos de test
  await db.from('predictions').delete().eq('porra_id', porraId)
  await db.from('porras').delete().eq('id', porraId)
  await deleteTestUser(db, aliceId)
  await deleteTestUser(db, bobId)
  await deleteTestUser(db, charlieId)
})

describe('Leaderboard — puntuación y ranking por porra', () => {

  it('Los 3 usuarios empiezan con 0 puntos en la porra', async () => {
    const { data } = await db.from('scores')
      .select('user_id, total_points')
      .eq('porra_id', porraId)

    expect(data).toHaveLength(3)
    data!.forEach(row => expect(row.total_points).toBe(0))
  })

  it('Al marcar resultado "1": Alice y Bob ganan puntos, Charlie no', async () => {
    // Trigger se dispara al actualizar goals + status = FT
    // result_ft debe ir explícito en el SET — Postgres solo dispara
    // AFTER UPDATE OF result_ft cuando la columna está en el SET clause original
    const { error } = await db.from('matches').update({
      status:        'FT',
      home_goals_ft: 2,
      away_goals_ft: 0,
      result_ft:     '1',
    }).eq('id', matchId)

    expect(error).toBeNull()

    const { data } = await db.from('scores')
      .select('user_id, total_points')
      .eq('porra_id', porraId)

    const byUser = Object.fromEntries(data!.map(r => [r.user_id, r.total_points]))

    expect(byUser[aliceId]).toBeGreaterThan(0)    // predijo '1' → acertó
    expect(byUser[bobId]).toBeGreaterThan(0)      // predijo '1' → acertó
    expect(byUser[charlieId]).toBe(0)             // predijo '2' → falló
  })

  it('Alice y Bob tienen los mismos puntos (misma predicción)', async () => {
    const { data } = await db.from('scores')
      .select('user_id, total_points')
      .eq('porra_id', porraId)
      .in('user_id', [aliceId, bobId])

    expect(data![0].total_points).toBe(data![1].total_points)
  })

  it('La vista leaderboard ordena correctamente: Alice/Bob antes que Charlie', async () => {
    const { data } = await db.from('leaderboard')
      .select('user_id, position, total_points')
      .eq('porra_id', porraId)
      .order('position', { ascending: true })

    expect(data).toHaveLength(3)

    // Charlie debe ser el último (0 puntos)
    const charlie = data!.find(r => r.user_id === charlieId)!
    expect(charlie.position).toBe(3)
    expect(charlie.total_points).toBe(0)

    // Alice y Bob comparten posición 1 o 2 (ambos con puntos)
    const topTwo = data!.filter(r => r.user_id !== charlieId)
    topTwo.forEach(r => expect(r.total_points).toBeGreaterThan(0))
  })

  it('La porra no contamina scores de otras porras (aislamiento)', async () => {
    // Buscar si hay scores de estos usuarios en otras porras
    const { data } = await db.from('scores')
      .select('porra_id, user_id, total_points')
      .in('user_id', [aliceId, bobId, charlieId])
      .neq('porra_id', porraId)

    // Si existen en otras porras, deben tener 0 puntos (no contaminados)
    data?.forEach(row => expect(row.total_points).toBe(0))
  })

  it('Las predicciones de los ganadores quedan marcadas como is_correct = true', async () => {
    const { data } = await db.from('predictions')
      .select('user_id, prediction, is_correct, points_awarded')
      .eq('porra_id', porraId)
      .eq('match_id', matchId)

    const byUser = Object.fromEntries(data!.map(r => [r.user_id, r]))

    expect(byUser[aliceId].is_correct).toBe(true)
    expect(byUser[aliceId].points_awarded).toBeGreaterThan(0)

    expect(byUser[bobId].is_correct).toBe(true)
    expect(byUser[bobId].points_awarded).toBeGreaterThan(0)

    expect(byUser[charlieId].is_correct).toBe(false)
    expect(byUser[charlieId].points_awarded).toBe(0)
  })
})
