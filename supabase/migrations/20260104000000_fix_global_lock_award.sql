-- ============================================================
-- FIX CRÍTICO: el bloqueo global rechazaba el award de puntos
-- ============================================================
-- `lock_predictions_at_kickoff()` (redefinido por el bloqueo global en
-- 20260103000000_global_lock.sql) lanzaba excepción en CUALQUIER update a
-- `predictions` una vez iniciado el torneo (>= 2026-06-11 18:00 UTC).
--
-- Problema: `award_points_on_result()` actualiza is_correct / points_awarded /
-- is_locked DESPUÉS de cada partido (siempre con el torneo ya iniciado), así
-- que el trigger abortaba esa transacción → rollback → ningún partido guardaba
-- resultado ni puntos (matchesUpdated: 0 en el backfill).
--
-- Nota histórica: este fix sustituye a 20260103000000_fix_prediction_lock.sql,
-- que nunca se aplicó en prod por colisión de timestamp con el global_lock
-- (ambos eran 20260103000000, y la versión ya constaba como aplicada).
--
-- Fix: el bloqueo (torneo iniciado / predicción ya bloqueada) solo se evalúa
-- cuando el usuario cambia su apuesta real (`prediction`). Los updates del
-- sistema no tocan `prediction`, así que pasan siempre. Se conserva la
-- semántica del bloqueo global para las ediciones reales de los usuarios.
-- ============================================================

create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
begin
  -- Solo aplicar el bloqueo cuando cambia la apuesta del usuario ('1'/'X'/'2').
  if new.prediction is distinct from old.prediction then
    if now() >= '2026-06-11 18:00:00+00'::timestamptz then
      raise exception 'Las predicciones están cerradas (el torneo ha comenzado)';
    end if;
    if old.is_locked = true then
      raise exception 'Esta predicción ya está bloqueada';
    end if;
  end if;
  return new;
end;
$$;
