-- ============================================================
-- MIGRACIÓN: Bloqueo global de predicciones
-- ============================================================
-- Todas las predicciones se bloquean 1h antes del primer partido
-- del torneo (2026-06-11 18:00:00 UTC) en lugar de hacerlo
-- individualmente al kick-off de cada partido.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TRIGGER: bloqueo global en vez de por partido
-- ────────────────────────────────────────────────────────────
create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
begin
  if now() >= '2026-06-11 18:00:00+00'::timestamptz then
    raise exception 'Las predicciones están cerradas (el torneo ha comenzado)';
  end if;
  if old.is_locked = true then
    raise exception 'Esta predicción ya está bloqueada';
  end if;
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. RLS predictions: INSERT — cerrar globalmente
-- ────────────────────────────────────────────────────────────
drop policy if exists "Usuario crea sus propias predicciones" on public.predictions;

create policy "Usuario crea sus propias predicciones"
  on public.predictions for insert
  with check (
    auth.uid() = user_id
    and now() < '2026-06-11 18:00:00+00'::timestamptz
  );

-- ────────────────────────────────────────────────────────────
-- 3. RLS predictions: SELECT — revelar todas tras el cierre
-- ────────────────────────────────────────────────────────────
drop policy if exists "Usuarios ven predicciones de otros SOLO tras kick-off" on public.predictions;

create policy "Todos ven predicciones tras el cierre global"
  on public.predictions for select
  using (
    now() >= '2026-06-11 18:00:00+00'::timestamptz
  );

-- ────────────────────────────────────────────────────────────
-- 4. RLS golden_boot_predictions: sincronizar con cierre global
-- ────────────────────────────────────────────────────────────
drop policy if exists "Todos ven Bota de Oro tras inicio del torneo" on public.golden_boot_predictions;

create policy "Todos ven Bota de Oro tras el cierre global"
  on public.golden_boot_predictions for select
  using (
    auth.uid() = user_id
    or now() >= '2026-06-11 18:00:00+00'::timestamptz
  );
