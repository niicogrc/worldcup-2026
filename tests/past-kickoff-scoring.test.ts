import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser, getFirstMatch } from './helpers/db'

/**
 * Regression test para el bug crítico donde enforce_prediction_lock bloqueaba
 * al sistema (award_points_on_result) de marcar predicciones como is_correct.
 *
 * El bug: enforce_prediction_lock disparaba para CUALQUIER UPDATE en predictions,
 * incluidos los del sistema. Como el trigger comprueba kickoff_at <= now(), y los
 * partidos reales ya han empezado, bloqueaba el update → rollback de toda la
 * transacción → ni el resultado del partido ni los puntos se guardaban nunca.
 *
 * Este test simula exactamente lo que pasa en producción: un partido cuyo
 * kickoff_at está en el pasado recibe un resultado y debe repartir puntos.
 */

const db = adminClient()

let aliceId: string
let bobId: string
let porraId: string
let matchId: string
let originalKickoffAt: string
let originalStatus: string

beforeAll(async () => {
  const alice = await createTestUser(db, 'test-alice-past@porra.test', 'Alice Past')
  const bob   = await createTestUser(db, 'test-bob-past@porra.test',   'Bob Past')
  aliceId = alice.userId
  bobId   = bob.userId

  const { data: p } = await db.from('porras')
    .insert({ name: '[TEST] Porra Past Kickoff', created_by: aliceId })
    .select('id').single()
  porraId = p.id
  await db.from('porra_members').insert({ porra_id: porraId, user_id: bobId })

  // Usar el tercer partido NS para no colisionar con otros tests (offset=2)
  const match = await getFirstMatch(db, 2)
  matchId          = match.id
  originalKickoffAt = match.kickoff_at
  originalStatus   = match.status

  // Simular que el partido ya ha empezado hace 2 horas (escenario de producción)
  await db.from('matches').update({
    kickoff_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  }).eq('id', matchId)

  // Las predicciones se insertan ANTES de que se marque el resultado
  await db.from('predictions').insert([
    { porra_id: porraId, user_id: aliceId, match_id: matchId, prediction: '1' },
    { porra_id: porraId, user_id: bobId,   match_id: matchId, prediction: '2' },
  ])
})

afterAll(async () => {
  // Restaurar partido al estado original
  await db.from('matches').update({
    kickoff_at:    originalKickoffAt,
    status:        originalStatus,
    home_goals_ft: null,
    away_goals_ft: null,
    result_ft:     null,
    last_synced_at: null,
  }).eq('id', matchId)

  await db.from('predictions').delete().eq('porra_id', porraId)
  await db.from('porras').delete().eq('id', porraId)
  await deleteTestUser(db, aliceId)
  await deleteTestUser(db, bobId)
})

describe('Puntuación con partido ya comenzado (kickoff en el pasado)', () => {

  it('El trigger no bloquea el update del partido aunque kickoff_at < now()', async () => {
    // Este es el escenario exacto de producción:
    // kickoff_at está en el pasado, el partido termina y el sync intenta guardarlo.
    // ANTES del fix, enforce_prediction_lock lanzaba excepción aquí → rollback total.
    const { error } = await db.from('matches').update({
      status:        'FT',
      home_goals_ft: 1,
      away_goals_ft: 0,
      result_ft:     '1',
    }).eq('id', matchId)

    expect(error).toBeNull()
  })

  it('Alice gana puntos (acertó "1"), Bob no (predijo "2")', async () => {
    const { data } = await db.from('scores')
      .select('user_id, total_points')
      .eq('porra_id', porraId)

    const byUser = Object.fromEntries(data!.map(r => [r.user_id, r.total_points]))
    expect(byUser[aliceId]).toBeGreaterThan(0)
    expect(byUser[bobId]).toBe(0)
  })

  it('Las predicciones quedan marcadas correctamente', async () => {
    const { data } = await db.from('predictions')
      .select('user_id, is_correct, points_awarded')
      .eq('porra_id', porraId)
      .eq('match_id', matchId)

    const byUser = Object.fromEntries(data!.map(r => [r.user_id, r]))
    expect(byUser[aliceId].is_correct).toBe(true)
    expect(byUser[aliceId].points_awarded).toBeGreaterThan(0)
    expect(byUser[bobId].is_correct).toBe(false)
    expect(byUser[bobId].points_awarded).toBe(0)
  })

  it('El usuario NO puede cambiar su predicción después del kickoff', async () => {
    // El fix no debe romper la protección para usuarios
    const { error } = await db.from('predictions')
      .update({ prediction: '2' })
      .eq('porra_id', porraId)
      .eq('user_id', aliceId)
      .eq('match_id', matchId)

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/cerradas|bloqueada/i)
  })
})
