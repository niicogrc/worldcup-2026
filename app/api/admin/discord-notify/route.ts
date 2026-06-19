import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import {
  snapshotLeaderboard,
  buildFacts,
  fallbackText,
  postToDiscord,
  deleteDiscordMessage,
  narrate,
  type MatchUpdate,
  type LeaderboardRow,
} from '@/lib/notify'

// POST /api/admin/discord-notify
// Borra el mensaje de Discord anterior y reenvía la notificación del último
// sync (o de las últimas N horas) filtrada por la whitelist de porras.
//
// Body (todos opcionales):
//   deleteMessageId?: string   — ID del mensaje de Discord a borrar (usa el del último sync_log si no se pasa)
//   hoursBack?: number         — ventana de partidos a incluir en horas (default 24)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const hoursBack: number = typeof body.hoursBack === 'number' ? body.hoursBack : 24

  const admin = createAdminClient()

  // ── 1. Resolver el ID del mensaje a borrar ──────────────────────────────
  let deleteMessageId: string | null = body.deleteMessageId ?? null

  if (!deleteMessageId) {
    // Buscar en el historial de syncs el último mensaje enviado
    const { data: lastLog } = await (admin as any)
      .from('sync_logs')
      .select('discord_message_id')
      .not('discord_message_id', 'is', null)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    deleteMessageId = lastLog?.discord_message_id ?? null
  }

  // ── 2. Borrar el mensaje anterior (best-effort) ─────────────────────────
  if (deleteMessageId) {
    await deleteDiscordMessage(deleteMessageId)
  }

  // ── 3. Obtener partidos que terminaron en la ventana de tiempo ──────────
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
  const { data: recentMatches } = await (admin as any)
    .from('matches')
    .select('id, phase, home_goals_ft, away_goals_ft, result_ft, home_team_id, away_team_id')
    .not('result_ft', 'is', null)
    .gte('last_synced_at', cutoff)

  if (!recentMatches || recentMatches.length === 0) {
    return NextResponse.json({ error: 'No hay partidos recientes para notificar' }, { status: 400 })
  }

  // ── 4. Nombres de equipos ───────────────────────────────────────────────
  const { data: teams } = await (admin as any).from('teams').select('id, name')
  const teamName = new Map<string, string>(
    (teams ?? []).map((t: any) => [t.id as string, t.name as string]),
  )

  const matchUpdates: MatchUpdate[] = recentMatches.map((m: any) => ({
    homeTeam: teamName.get(m.home_team_id) ?? 'Unknown',
    awayTeam: teamName.get(m.away_team_id) ?? 'Unknown',
    homeScore: m.home_goals_ft ?? 0,
    awayScore: m.away_goals_ft ?? 0,
    result: m.result_ft as '1' | 'X' | '2',
    phase: m.phase,
  }))

  // ── 5. Leaderboard actual como "after" ──────────────────────────────────
  const after: LeaderboardRow[] = await snapshotLeaderboard(admin)

  // ── 6. Reconstruir "before" restando puntos de los partidos recientes ───
  const { data: recentPreds } = await (admin as any)
    .from('predictions')
    .select('porra_id, user_id, points_awarded')
    .in('match_id', recentMatches.map((m: any) => m.id))

  const gainedMap = new Map<string, number>()
  for (const p of recentPreds ?? []) {
    const k = `${p.porra_id}:${p.user_id}`
    gainedMap.set(k, (gainedMap.get(k) ?? 0) + (p.points_awarded ?? 0))
  }

  const before: LeaderboardRow[] = after.map(r => ({
    ...r,
    totalPoints: r.totalPoints - (gainedMap.get(`${r.porraId}:${r.userId}`) ?? 0),
  }))

  // ── 7. Construir facts con whitelist y enviar ───────────────────────────
  const facts = buildFacts(matchUpdates, before, after)
  if (facts.porras.length === 0 && facts.matches.length === 0) {
    return NextResponse.json({ error: 'Nada que notificar con la whitelist actual' }, { status: 400 })
  }

  const content = ((await narrate(facts)) ?? fallbackText(facts))
  const messageId = await postToDiscord(content)

  // ── 8. Guardar el nuevo messageId en un sync_log (triggered_by=manual) ──
  if (messageId) {
    await (admin as any).from('sync_logs').insert({
      matches_checked: recentMatches.length,
      matches_updated: recentMatches.length,
      api_calls_used: 0,
      triggered_by: 'manual',
      discord_message_id: messageId,
    })
  }

  return NextResponse.json({ success: true, messageId, deletedMessageId: deleteMessageId })
}
