import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { adminClient, createTestUser, deleteTestUser, getFirstMatch } from './helpers/db'

const db = adminClient()

// Mirrors the constant in app/api/admin/recalculate/route.ts
const SCORE_RESET = {
  points_group: 0, correct_group: 0,
  points_round_of_32: 0, correct_round_of_32: 0,
  points_round_of_16: 0, correct_round_of_16: 0,
  points_quarter_final: 0, correct_quarter_final: 0,
  points_semi_final: 0, correct_semi_final: 0,
  points_third_place: 0, correct_third_place: 0,
  points_final: 0, correct_final: 0,
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Admin — cambio de rol de usuario', () => {
  let userId: string

  beforeAll(async () => {
    const user = await createTestUser(db, 'test-admin1@porra.test', 'Admin Test User 1')
    userId = user.userId
  })

  afterAll(async () => {
    await db.from('profiles').update({ role: 'participant' }).eq('id', userId)
    await deleteTestUser(db, userId)
  })

  it('El perfil tiene rol participant por defecto', async () => {
    const { data, error } = await db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    expect(error).toBeNull()
    expect(data!.role).toBe('participant')
  })

  it('Se puede cambiar el rol a admin', async () => {
    const { error } = await db
      .from('profiles')
      .update({ role: 'admin' } as any)
      .eq('id', userId)

    expect(error).toBeNull()

    const { data } = await db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    expect(data!.role).toBe('admin')
  })

  it('Se puede volver a cambiar el rol a participant', async () => {
    const { error } = await db
      .from('profiles')
      .update({ role: 'participant' } as any)
      .eq('id', userId)

    expect(error).toBeNull()

    const { data } = await db
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    expect(data!.role).toBe('participant')
  })

  it('Un valor de rol inválido es rechazado por el constraint de DB', async () => {
    const { error } = await db
      .from('profiles')
      .update({ role: 'superadmin' as any })
      .eq('id', userId)

    expect(error).not.toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Admin — cascade delete al borrar una porra', () => {
  let userId: string
  let porraId: string
  let matchId: string

  beforeAll(async () => {
    const user = await createTestUser(db, 'test-admin2@porra.test', 'Admin Test User 2')
    userId = user.userId

    const { data: p } = await db
      .from('porras')
      .insert({ name: '[TEST] Porra Cascade', created_by: userId })
      .select('id')
      .single()
    porraId = p!.id

    const match = await getFirstMatch(db, 2)
    matchId = match.id

    await db.from('predictions').insert({
      porra_id: porraId,
      user_id: userId,
      match_id: matchId,
      prediction: '1',
    })
    await db.from('golden_boot_predictions').insert({
      porra_id: porraId,
      user_id: userId,
      player_name: 'Test Player Cascade',
    })
  })

  afterAll(async () => {
    // No-op si el test ya la borró; seguro hacer igualmente
    await db.from('porras').delete().eq('id', porraId)
    await deleteTestUser(db, userId)
  })

  it('La porra existe con sus datos antes de borrarla', async () => {
    const [{ data: porra }, { data: preds }, { data: gb }] = await Promise.all([
      db.from('porras').select('id').eq('id', porraId).single(),
      db.from('predictions').select('id').eq('porra_id', porraId),
      db.from('golden_boot_predictions').select('id').eq('porra_id', porraId),
    ])

    expect(porra!.id).toBe(porraId)
    expect(preds).toHaveLength(1)
    expect(gb).toHaveLength(1)
  })

  it('Al borrar la porra se eliminan porra_members, scores, predictions y golden_boot_predictions', async () => {
    const { error } = await db.from('porras').delete().eq('id', porraId)
    expect(error).toBeNull()

    const [{ data: members }, { data: scores }, { data: preds }, { data: gb }] = await Promise.all([
      db.from('porra_members').select('user_id').eq('porra_id', porraId),
      db.from('scores').select('user_id').eq('porra_id', porraId),
      db.from('predictions').select('id').eq('porra_id', porraId),
      db.from('golden_boot_predictions').select('id').eq('porra_id', porraId),
    ])

    expect(members).toHaveLength(0)
    expect(scores).toHaveLength(0)
    expect(preds).toHaveLength(0)
    expect(gb).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Admin — aislamiento de scores en recálculo por porra', () => {
  let aliceId: string
  let porraAId: string
  let porraBId: string
  let matchId: string
  let originalMatchStatus: string

  beforeAll(async () => {
    const alice = await createTestUser(db, 'test-admin3@porra.test', 'Admin Alice Recalc')
    aliceId = alice.userId

    const [{ data: pA }, { data: pB }] = await Promise.all([
      db.from('porras').insert({ name: '[TEST] Porra Recalc A', created_by: aliceId }).select('id').single(),
      db.from('porras').insert({ name: '[TEST] Porra Recalc B', created_by: aliceId }).select('id').single(),
    ])
    porraAId = pA!.id
    porraBId = pB!.id

    // offset=3 — no colisiona con predictions (0), leaderboard (1), ni cascade (2)
    const match = await getFirstMatch(db, 3)
    matchId = match.id
    originalMatchStatus = match.status

    // Alice predice en porra A solamente
    await db.from('predictions').insert({
      porra_id: porraAId,
      user_id: aliceId,
      match_id: matchId,
      prediction: '1',
    })
  })

  afterAll(async () => {
    await db.from('matches').update({
      status:        originalMatchStatus,
      home_goals_ft: null,
      away_goals_ft: null,
      result_ft:     null,
      last_synced_at: null,
    }).eq('id', matchId)

    await db.from('predictions').delete().eq('porra_id', porraAId)
    await db.from('porras').delete().eq('id', porraAId)
    await db.from('porras').delete().eq('id', porraBId)
    await deleteTestUser(db, aliceId)
  })

  it('Alice empieza con 0 puntos en ambas porras', async () => {
    const { data } = await db
      .from('scores')
      .select('porra_id, total_points')
      .eq('user_id', aliceId)
      .in('porra_id', [porraAId, porraBId])

    expect(data).toHaveLength(2)
    data!.forEach(row => expect(row.total_points).toBe(0))
  })

  it('Al marcar resultado "1", Alice gana puntos en porra A (tiene predicción ahí)', async () => {
    await db.from('matches').update({
      status:        'FT',
      home_goals_ft: 1,
      away_goals_ft: 0,
      result_ft:     '1',
    }).eq('id', matchId)

    const { data } = await db
      .from('scores')
      .select('total_points')
      .eq('porra_id', porraAId)
      .eq('user_id', aliceId)
      .single()

    expect(data!.total_points).toBeGreaterThan(0)
  })

  it('Porra B de Alice permanece a 0 (no hay predicción en porra B)', async () => {
    const { data } = await db
      .from('scores')
      .select('total_points')
      .eq('porra_id', porraBId)
      .eq('user_id', aliceId)
      .single()

    expect(data!.total_points).toBe(0)
  })

  it('Reset por porra (como hace el endpoint recalculate) no afecta porra B', async () => {
    // Verificar que porra A tiene puntos antes del reset
    const { data: beforeA } = await db
      .from('scores')
      .select('total_points')
      .eq('porra_id', porraAId)
      .eq('user_id', aliceId)
      .single()
    expect(beforeA!.total_points).toBeGreaterThan(0)

    // Simular el reset filtrado por porra (la clave del fix)
    await db.from('scores').update(SCORE_RESET as any).eq('porra_id', porraAId)

    const [{ data: afterA }, { data: afterB }] = await Promise.all([
      db.from('scores').select('total_points').eq('porra_id', porraAId).eq('user_id', aliceId).single(),
      db.from('scores').select('total_points').eq('porra_id', porraBId).eq('user_id', aliceId).single(),
    ])

    expect(afterA!.total_points).toBe(0)     // porra A reseteada
    expect(afterB!.total_points).toBe(0)     // porra B no tocada (seguía a 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('Admin — asignación de equipos en partidos de eliminatoria', () => {
  let knockoutMatchId: string
  let originalHomeTeamId: string | null
  let originalAwayTeamId: string | null
  let teamAId: string
  let teamBId: string

  beforeAll(async () => {
    const { data: matches, error } = await db
      .from('matches')
      .select('id, home_team_id, away_team_id')
      .eq('phase', 'round_of_32')
      .eq('status', 'NS')
      .limit(1)

    if (error || !matches?.length) {
      throw new Error('No se encontró un partido round_of_32 NS — ejecuta el seed primero')
    }

    knockoutMatchId    = matches[0].id
    originalHomeTeamId = matches[0].home_team_id
    originalAwayTeamId = matches[0].away_team_id

    const { data: teams } = await db
      .from('teams')
      .select('id')
      .order('name', { ascending: true })
      .limit(2)

    if (!teams || teams.length < 2) throw new Error('No hay equipos en la DB — ejecuta el seed primero')
    teamAId = teams[0].id
    teamBId = teams[1].id
  })

  afterAll(async () => {
    if (knockoutMatchId) {
      await db.from('matches').update({
        home_team_id: originalHomeTeamId,
        away_team_id: originalAwayTeamId,
      }).eq('id', knockoutMatchId)
    }
  })

  it('Se pueden asignar equipos a un partido de eliminatoria', async () => {
    const { error } = await db.from('matches').update({
      home_team_id: teamAId,
      away_team_id: teamBId,
    }).eq('id', knockoutMatchId)

    expect(error).toBeNull()
  })

  it('Los equipos asignados son recuperables con join', async () => {
    const { data, error } = await db
      .from('matches')
      .select(`
        id,
        home_team:teams!matches_home_team_id_fkey(id, name),
        away_team:teams!matches_away_team_id_fkey(id, name)
      `)
      .eq('id', knockoutMatchId)
      .single()

    expect(error).toBeNull()
    expect((data!.home_team as any)?.id).toBe(teamAId)
    expect((data!.away_team as any)?.id).toBe(teamBId)
  })

  it('Se puede desasignar un equipo (null)', async () => {
    const { error } = await db
      .from('matches')
      .update({ home_team_id: null })
      .eq('id', knockoutMatchId)

    expect(error).toBeNull()

    const { data } = await db
      .from('matches')
      .select('home_team_id')
      .eq('id', knockoutMatchId)
      .single()

    expect(data!.home_team_id).toBeNull()
  })
})
