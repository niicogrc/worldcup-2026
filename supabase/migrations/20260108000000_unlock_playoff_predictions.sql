-- ============================================================
-- Reabrir predicciones de ELIMINATORIAS (cuadro de playoffs)
-- ============================================================
-- Contexto: el bloqueo global (20260103000000_global_lock.sql) cerró TODAS
-- las predicciones 1 h antes del primer partido (2026-06-11 18:00 UTC),
-- asumiendo que el cuadro de playoffs se predecía por adelantado sobre los
-- huecos TBD. En la práctica el cuadro nunca se predijo, así que con el
-- torneo en marcha nadie puede apostar las eliminatorias: el INSERT en
-- `predictions` falla con "new row violates row-level security policy".
--
-- Fix: el cuadro vuelve al bloqueo ORIGINAL por kick-off de cada partido
-- (regla de negocio "cada predicción se bloquea en su kick-off"), mientras
-- que la fase de GRUPOS conserva el candado global del 11 jun (esos puntos
-- ya están asignados y no deben reabrirse).
--
-- Resumen del comportamiento tras esta migración:
--   - GRUPOS:        cerrado desde 2026-06-11 18:00 UTC (sin cambios).
--   - ELIMINATORIAS: abierto hasta el kick-off de cada partido concreto.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. RLS INSERT: grupos bajo candado global; eliminatorias por kick-off
-- ────────────────────────────────────────────────────────────
drop policy if exists "Usuario crea sus propias predicciones" on public.predictions;

create policy "Usuario crea sus propias predicciones"
  on public.predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.kickoff_at > now()                       -- el partido no ha empezado
        and (
          m.phase <> 'group'                            -- eliminatorias: solo kick-off
          or now() < '2026-06-11 18:00:00+00'::timestamptz  -- grupos: candado global
        )
    )
  );

-- La política de UPDATE "Usuario actualiza sus predicciones (no bloqueadas)"
-- (auth.uid() = user_id and is_locked = false) se conserva tal cual: una
-- predicción de eliminatoria recién creada tiene is_locked = false y se puede
-- reeditar hasta que el trigger la bloquee al asignar puntos.

-- ────────────────────────────────────────────────────────────
-- 2. TRIGGER: bloqueo diferenciado por fase
-- ────────────────────────────────────────────────────────────
-- Solo se evalúa cuando cambia la apuesta real del usuario (`prediction`),
-- igual que en 20260104000000: los UPDATE del sistema (award_points_on_result
-- escribe is_correct/points_awarded/is_locked, no toca prediction) siguen
-- pasando sin problema.
create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
declare
  v_phase   public.tournament_phase;
  v_kickoff timestamptz;
begin
  if new.prediction is distinct from old.prediction then
    select m.phase, m.kickoff_at
      into v_phase, v_kickoff
      from public.matches m
      where m.id = new.match_id;

    if v_phase = 'group' then
      -- Grupos: candado global (torneo iniciado).
      if now() >= '2026-06-11 18:00:00+00'::timestamptz then
        raise exception 'Las predicciones de grupos están cerradas (el torneo ha comenzado)';
      end if;
    else
      -- Eliminatorias: candado al kick-off del propio partido.
      if v_kickoff is not null and now() >= v_kickoff then
        raise exception 'Las predicciones para este partido ya están cerradas';
      end if;
    end if;

    if old.is_locked = true then
      raise exception 'Esta predicción ya está bloqueada';
    end if;
  end if;
  return new;
end;
$$;
