-- ============================================================
-- FIX: recompute_all_scores() fallaba con "UPDATE requires a WHERE clause"
-- ============================================================
-- La DB tiene activado el guard de safe-updates (rechaza UPDATE/DELETE
-- sin WHERE). En `recompute_all_scores()` (migración 20260105) había dos
-- UPDATE sobre `scores` sin WHERE:
--   - el reset de columnas por fase (points_<fase> = 0, correct_<fase> = 0)
--   - el bump de updated_at
-- Resultado: /api/admin/recalculate devolvía 500 y el cron de 3h no podía
-- recalcular.
--
-- Fix: añadir `where true` explícito (resetea todas las filas, declarándolo).
-- Solo cambian esas dos sentencias; el resto de la función es idéntico.
-- ============================================================

create or replace function recompute_all_scores()
returns void language plpgsql security definer as $$
declare
  v_phase  text;
  v_phases text[] := array[
    'group','round_of_32','round_of_16','quarter_final',
    'semi_final','third_place','final'
  ];
begin
  -- 1. Recomputar cada predicción desde el resultado actual del partido.
  update public.predictions pr set
    is_correct     = (pr.prediction = m.result_ft),
    points_awarded = case when pr.prediction = m.result_ft then sr.points_correct else 0 end,
    is_locked      = true
  from public.matches m
  join public.scoring_rules sr on sr.phase = m.phase
  where pr.match_id = m.id and m.result_ft is not null;

  -- Predicciones de partidos aún sin resultado → a cero.
  update public.predictions pr set
    is_correct = null, points_awarded = 0
  from public.matches m
  where pr.match_id = m.id and m.result_ft is null;

  -- 2. Resetear columnas de puntos por fase (se preserva points_golden_boot).
  foreach v_phase in array v_phases loop
    execute format('update public.scores set points_%1$s = 0, correct_%1$s = 0 where true', v_phase);
  end loop;
  update public.scores set updated_at = now() where true;

  -- 3. Re-agregar por fase desde las predicciones ya recomputadas.
  foreach v_phase in array v_phases loop
    execute format($f$
      update public.scores s set points_%1$s = agg.pts, correct_%1$s = agg.cnt
      from (
        select pr.porra_id, pr.user_id,
               coalesce(sum(pr.points_awarded), 0)        as pts,
               count(*) filter (where pr.is_correct is true) as cnt
        from public.predictions pr
        join public.matches m on m.id = pr.match_id
        where m.phase = %2$L and m.result_ft is not null
        group by pr.porra_id, pr.user_id
      ) agg
      where s.porra_id = agg.porra_id and s.user_id = agg.user_id
    $f$, v_phase, v_phase);
  end loop;
end;
$$;
