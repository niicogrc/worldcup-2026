import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { getActivePorraId } from '@/lib/active-porra'
import { clsx } from 'clsx'

export const dynamic = 'force-dynamic'

const PHASE_LABELS: Record<string, string> = {
  group: 'Grupos',
  round_of_32: '1/32',
  round_of_16: 'Octavos',
  quarter_final: 'Cuartos',
  semi_final: 'Semis',
  third_place: '3er puesto',
  final: 'Final',
}

const PHASE_POINTS: Record<string, number> = {
  group: 3,
  round_of_32: 3,
  round_of_16: 4,
  quarter_final: 6,
  semi_final: 8,
  third_place: 5,
  final: 15,
}

function PredBadge({ pred, correct }: { pred: string | null; correct: boolean | null }) {
  if (!pred) return <span className="text-zinc-600 text-xs">—</span>

  const colorMap: Record<string, string> = {
    '1': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    'X': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    '2': 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  }

  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border', colorMap[pred])}>
      {pred}
      {correct === true && <span className="text-green-400">&#10003;</span>}
      {correct === false && <span className="text-red-400">&#10007;</span>}
    </span>
  )
}

export default async function ComoFuncionaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const porraId = await getActivePorraId(supabase as any, user.id, isAdmin(user.email))
  if (!porraId) redirect('/onboarding')

  // Predicciones del usuario en esta porra, para armar ejemplos reales y personalizados
  const { data: myPreds } = await (supabase as any)
    .from('predictions')
    .select('match_id, prediction, is_correct, points_awarded')
    .eq('porra_id', porraId)
    .eq('user_id', user.id)

  const predMap = Object.fromEntries((myPreds ?? []).map((p: any) => [p.match_id, p]))

  const { data: matchesRaw } = await (supabase as any)
    .from('matches')
    .select(`
      id, phase, kickoff_at, result_ft,
      home_goals_ft, away_goals_ft,
      home_team:teams!matches_home_team_id_fkey(name, short_code),
      away_team:teams!matches_away_team_id_fkey(name, short_code)
    `)
    .not('result_ft', 'is', null)
    .order('kickoff_at', { ascending: false })

  const matches = (matchesRaw ?? []) as any[]

  // Ejemplos: una predicción acertada y una fallada, priorizando playoffs por ser lo que más confunde
  const withPred = matches
    .map(m => ({ match: m, pred: predMap[m.id] }))
    .filter(x => x.pred)

  const playoffExamples = withPred.filter(x => x.match.phase !== 'group')
  const groupExamples = withPred.filter(x => x.match.phase === 'group')

  const pickExample = (pool: typeof withPred, correct: boolean) =>
    pool.find(x => x.pred.is_correct === correct)

  const examples = [
    pickExample(playoffExamples, true) ?? pickExample(groupExamples, true),
    pickExample(playoffExamples, false) ?? pickExample(groupExamples, false),
  ].filter(Boolean) as typeof withPred

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cómo funciona la porra</h1>
        <p className="text-sm text-zinc-500 mt-0.5">La explicación de siempre, con tus propios partidos como ejemplo</p>
      </div>

      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 space-y-4">
        <h2 className="text-base font-semibold text-white">La idea, en 4 pasos</h2>
        <ol className="space-y-3 text-sm text-zinc-300 list-decimal list-inside">
          <li><span className="text-zinc-400">Antes de que empiece un partido</span>, apuestas un resultado: gana el local (<span className="text-blue-300 font-semibold">1</span>), empate (<span className="text-zinc-300 font-semibold">X</span>) o gana el visitante (<span className="text-purple-300 font-semibold">2</span>).</li>
          <li><span className="text-zinc-400">Cuando el partido termina</span>, la web mira el resultado real a los 90 minutos (la prórroga y los penaltis no cuentan para la porra).</li>
          <li><span className="text-zinc-400">Compara tu apuesta con lo que pasó de verdad.</span> Si acertaste, ganas puntos. Si fallaste, cero.</li>
          <li><span className="text-zinc-400">Se suman todos tus aciertos</span> y con eso se hace la clasificación — no hay que calcular nada a mano, la web lo hace sola en cuanto se mete el resultado.</li>
        </ol>
      </div>

      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold text-white">Cuánto vale acertar en cada ronda</h2>
        <p className="text-xs text-zinc-500">Cuanto más avanza el torneo, más vale acertar</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(PHASE_POINTS).map(([phase, pts]) => (
            <div key={phase} className="bg-[#0c0d12] border border-[#1f2333] rounded-lg px-3 py-2">
              <div className="text-[11px] text-zinc-500">{PHASE_LABELS[phase]}</div>
              <div className="text-lg font-bold text-white">{pts} <span className="text-xs font-normal text-zinc-500">pts</span></div>
            </div>
          ))}
        </div>
      </div>

      {examples.length > 0 && (
        <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">Ejemplos con tus propias apuestas</h2>
          <div className="divide-y divide-[#1f2333]">
            {examples.map(({ match, pred }) => {
              const homeTeam = match.home_team?.short_code ?? match.home_team?.name ?? '?'
              const awayTeam = match.away_team?.short_code ?? match.away_team?.name ?? '?'
              const pts = pred.points_awarded ?? 0
              return (
                <div key={match.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-500">{PHASE_LABELS[match.phase]}</div>
                    <div className="text-sm text-white truncate">
                      {homeTeam} {match.home_goals_ft}-{match.away_goals_ft} {awayTeam}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      Apostaste <span className="font-semibold text-zinc-300">{pred.prediction}</span>, el resultado real fue{' '}
                      <span className="font-semibold text-zinc-300">{match.result_ft}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <PredBadge pred={pred.prediction} correct={pred.is_correct} />
                    <span className={clsx('text-xs font-bold', pred.is_correct ? 'text-green-400' : 'text-zinc-600')}>
                      {pred.is_correct ? `+${pts} pts` : '0 pts'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-zinc-500">
            Esto es exactamente lo mismo que pasa con cada partido: la web compara tu apuesta contra el resultado real y reparte los puntos automáticamente.
          </p>
        </div>
      )}

      <div className="bg-[#13151c] border border-[#1f2333] rounded-xl p-5 space-y-3">
        <h2 className="text-base font-semibold text-white">¿Y los partidos de playoffs que aún no tenían equipos?</h2>
        <p className="text-sm text-zinc-400">
          En octavos, cuartos, semis, 3er puesto y la final puedes predecir un cruce del cuadro (por ejemplo &ldquo;el ganador del cruce de la izquierda&rdquo;)
          antes de saber qué equipos concretos van a jugarlo. En cuanto se sabe qué equipos ocupan ese cruce, tu apuesta pasa a valer para ese partido
          real automáticamente — no hace falta volver a predecir nada.
        </p>
      </div>
    </div>
  )
}
