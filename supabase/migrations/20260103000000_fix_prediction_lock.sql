-- ────────────────────────────────────────────────────────────
-- FIX CRÍTICO: enforce_prediction_lock bloqueaba las actualizaciones
-- del sistema (award_points_on_result), no solo las del usuario.
--
-- Causa raíz — por qué 0/104 partidos tenían resultado:
--   La versión anterior de lock_predictions_at_kickoff() lanzaba una
--   excepción en CUALQUIER update a `predictions` cuando
--   `kickoff_at <= now()`. Pero award_points_on_result() actualiza
--   is_correct / points_awarded / is_locked DESPUÉS de que el partido
--   termina (kickoff siempre en el pasado) → excepción → rollback de
--   toda la transacción → ni el resultado del partido ni los puntos
--   se guardaban, y home_goals_ft quedaba a null.
--
-- Fix: el lock solo debe aplicarse cuando el usuario intenta cambiar
--   su apuesta real (campo `prediction`). Las actualizaciones de
--   campos del sistema (is_correct, points_awarded, is_locked) pasan
--   siempre.
-- ────────────────────────────────────────────────────────────

create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
begin
  -- Solo bloquear cuando cambia la apuesta real del usuario ('1'/'X'/'2').
  -- Los updates del sistema no tocan `prediction`, así que no entran aquí.
  if new.prediction is distinct from old.prediction then
    -- Bloquear si el partido ya ha empezado
    if exists (
      select 1 from public.matches
      where id = new.match_id and kickoff_at <= now()
    ) then
      raise exception 'Las predicciones están cerradas para este partido (ya ha comenzado)';
    end if;

    -- Bloquear si la predicción ya está marcada como locked
    if old.is_locked = true then
      raise exception 'Esta predicción ya está bloqueada';
    end if;
  end if;

  return new;
end;
$$;
