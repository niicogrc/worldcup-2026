-- ────────────────────────────────────────────────────────────
-- Arreglo crítico: enforce_prediction_lock bloqueaba el sistema
-- ────────────────────────────────────────────────────────────
--
-- El trigger enforce_prediction_lock se disparaba para CUALQUIER
-- UPDATE en predictions, incluyendo los que hace el propio sistema
-- (award_points_on_result) para marcar is_correct/points_awarded.
--
-- Como award_points_on_result se ejecuta DESPUÉS de que el partido
-- ha terminado (kickoff_at ya pasó), la condición `kickoff_at <= now()`
-- era siempre TRUE → excepción → rollback de toda la transacción →
-- ni el resultado del partido ni los puntos se guardaban.
--
-- Solución: solo bloquear cuando el campo `prediction` cambia (el
-- apunte real del usuario). Los campos del sistema (is_correct,
-- points_awarded, is_locked) siempre se pueden actualizar.
-- ────────────────────────────────────────────────────────────

create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
begin
  -- Permitir actualizaciones de campos del sistema siempre.
  -- Solo aplicar restricciones si el valor de prediction cambia.
  if new.prediction is not distinct from old.prediction then
    return new;
  end if;

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

  return new;
end;
$$;
