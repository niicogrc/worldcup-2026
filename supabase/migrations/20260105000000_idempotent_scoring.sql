-- ============================================================
-- FIX: puntuación idempotente y recálculo atómico
-- ============================================================
-- Síntoma: usuarios con MENOS puntos que un día anterior.
--
-- Causa raíz: el único mecanismo que baja puntos es el recálculo
-- (`/api/admin/recalculate`), que NO era atómico: reseteaba `scores`
-- a 0 y luego actualizaba usuario por usuario con awaits sucesivos.
-- Si la función serverless se cortaba a medias (timeout / error de red),
-- los scores quedaban a 0 o parcialmente recompuestos → "menos puntos".
--
-- Además, el trigger `award_points_on_result` era ADITIVO puro: si un
-- resultado se corregía (p.ej. la fuente revisa el marcador), volvía a
-- sumar sin restar lo ya concedido → inflaba los puntos. La siguiente
-- pasada de recálculo los corregía a la baja, lo que también se percibe
-- como "bajaron los puntos".
--
-- Fix:
--   1. Trigger idempotente: aplica el DELTA (nuevo - ya concedido) por
--      predicción, así re-disparar o corregir un resultado nunca infla.
--   2. `recompute_all_scores()`: recálculo completo en UNA transacción
--      (atómico; si falla, rollback y los scores quedan intactos).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TRIGGER idempotente
-- ────────────────────────────────────────────────────────────
create or replace function award_points_on_result()
returns trigger language plpgsql security definer as $$
declare
  v_rule       scoring_rules%rowtype;
  v_pred       predictions%rowtype;
  v_new_pts    integer;
  v_new_corr   boolean;
  v_col_pts    text;
  v_col_corr   text;
begin
  if new.result_ft is null then return new; end if;
  -- Solo recalcular cuando el resultado realmente cambia.
  if old.result_ft is not distinct from new.result_ft then return new; end if;

  select * into v_rule from public.scoring_rules where phase = new.phase;
  if not found then return new; end if;

  v_col_pts  := 'points_'  || new.phase::text;
  v_col_corr := 'correct_' || new.phase::text;

  for v_pred in
    select * from public.predictions where match_id = new.id
  loop
    v_new_corr := (v_pred.prediction = new.result_ft);
    v_new_pts  := case when v_new_corr then v_rule.points_correct else 0 end;

    insert into public.scores (porra_id, user_id)
    values (v_pred.porra_id, v_pred.user_id)
    on conflict (porra_id, user_id) do nothing;

    -- DELTA respecto a lo ya concedido a ESTA predicción → idempotente.
    execute format(
      'update public.scores set %I = %I + $1, %I = %I + $2, updated_at = now() where porra_id = $3 and user_id = $4',
      v_col_pts, v_col_pts, v_col_corr, v_col_corr
    ) using
      (v_new_pts - coalesce(v_pred.points_awarded, 0)),
      ((case when v_new_corr then 1 else 0 end) - (case when v_pred.is_correct then 1 else 0 end)),
      v_pred.porra_id, v_pred.user_id;

    update public.predictions set
      is_correct     = v_new_corr,
      points_awarded = v_new_pts,
      is_locked      = true
    where id = v_pred.id;
  end loop;

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. RECÁLCULO ATÓMICO (una sola transacción)
-- ────────────────────────────────────────────────────────────
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
    execute format('update public.scores set points_%1$s = 0, correct_%1$s = 0', v_phase);
  end loop;
  update public.scores set updated_at = now();

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
