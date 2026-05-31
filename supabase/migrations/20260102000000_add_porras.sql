-- ============================================================
-- MIGRACIÓN: Sistema multi-porra
-- ============================================================
-- IMPORTANTE: Esta migración limpia los datos de usuario y
-- añade soporte para múltiples porras independientes.
-- Las predicciones y puntuaciones pasan a ser por porra.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PASO 0: Limpiar datos de usuario (reset explícito)
-- ────────────────────────────────────────────────────────────
delete from public.predictions;
delete from public.golden_boot_predictions;
delete from public.scores;
-- Nota: profiles se limpiará al borrar auth.users desde el Dashboard de Supabase

-- ────────────────────────────────────────────────────────────
-- 1. PORRAS
-- ────────────────────────────────────────────────────────────
create table public.porras (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger set_porras_updated_at
  before update on public.porras
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. PORRA_MEMBERS
-- ────────────────────────────────────────────────────────────
create table public.porra_members (
  id        uuid primary key default gen_random_uuid(),
  porra_id  uuid not null references public.porras(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (porra_id, user_id)
);

create index idx_porra_members_porra on public.porra_members(porra_id);
create index idx_porra_members_user  on public.porra_members(user_id);

-- ────────────────────────────────────────────────────────────
-- 3. MODIFICAR PREDICTIONS: añadir porra_id
-- ────────────────────────────────────────────────────────────
alter table public.predictions drop constraint predictions_user_id_match_id_key;

alter table public.predictions
  add column porra_id uuid not null references public.porras(id) on delete cascade;

alter table public.predictions
  add constraint predictions_porra_user_match_key unique (porra_id, user_id, match_id);

create index idx_predictions_porra on public.predictions(porra_id);

-- ────────────────────────────────────────────────────────────
-- 4. MODIFICAR GOLDEN_BOOT_PREDICTIONS: añadir porra_id
-- ────────────────────────────────────────────────────────────
alter table public.golden_boot_predictions drop constraint golden_boot_predictions_user_id_key;

alter table public.golden_boot_predictions
  add column porra_id uuid not null references public.porras(id) on delete cascade;

alter table public.golden_boot_predictions
  add constraint golden_boot_predictions_porra_user_key unique (porra_id, user_id);

-- ────────────────────────────────────────────────────────────
-- 5. MODIFICAR SCORES: añadir porra_id, cambiar PK
-- ────────────────────────────────────────────────────────────
drop trigger on_profile_created_init_scores on public.profiles;
drop function initialize_user_scores();

alter table public.scores drop constraint scores_pkey;
alter table public.scores alter column user_id set not null;

alter table public.scores
  add column porra_id uuid not null references public.porras(id) on delete cascade;

alter table public.scores add primary key (porra_id, user_id);

drop index if exists idx_scores_total;
drop index if exists idx_scores_groups;
drop index if exists idx_scores_playoffs;

create index idx_scores_porra_total    on public.scores(porra_id, total_points desc);
create index idx_scores_porra_groups   on public.scores(porra_id, total_points_groups desc);
create index idx_scores_porra_playoffs on public.scores(porra_id, total_points_playoffs desc);

-- ────────────────────────────────────────────────────────────
-- 6. TRIGGER: Inicializar scores al unirse a una porra
-- ────────────────────────────────────────────────────────────
create or replace function initialize_porra_scores()
returns trigger language plpgsql security definer as $$
begin
  insert into public.scores (porra_id, user_id)
  values (new.porra_id, new.user_id)
  on conflict (porra_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_porra_member_created_init_scores
  after insert on public.porra_members
  for each row execute procedure initialize_porra_scores();

-- También inicializar cuando el creador crea la porra
create or replace function on_porra_created_add_creator()
returns trigger language plpgsql security definer as $$
begin
  insert into public.porra_members (porra_id, user_id)
  values (new.id, new.created_by)
  on conflict (porra_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_porra_created_add_creator
  after insert on public.porras
  for each row execute procedure on_porra_created_add_creator();

-- ────────────────────────────────────────────────────────────
-- 7. ACTUALIZAR TRIGGER: award_points_on_result (ahora por porra)
-- ────────────────────────────────────────────────────────────
create or replace function award_points_on_result()
returns trigger language plpgsql security definer as $$
declare
  v_rule       scoring_rules%rowtype;
  v_pred       predictions%rowtype;
  v_pts        integer;
  v_correct    boolean;
  v_col_pts    text;
  v_col_corr   text;
begin
  if new.result_ft is null then return new; end if;
  if old.result_ft is not null and old.result_ft = new.result_ft then return new; end if;

  select * into v_rule from public.scoring_rules where phase = new.phase;
  if not found then return new; end if;

  v_col_pts  := 'points_'  || new.phase::text;
  v_col_corr := 'correct_' || new.phase::text;

  for v_pred in
    select * from public.predictions where match_id = new.id
  loop
    v_correct := (v_pred.prediction = new.result_ft);
    v_pts     := case when v_correct then v_rule.points_correct else 0 end;

    update public.predictions set
      is_correct     = v_correct,
      points_awarded = v_pts,
      is_locked      = true
    where id = v_pred.id;

    insert into public.scores (porra_id, user_id)
    values (v_pred.porra_id, v_pred.user_id)
    on conflict (porra_id, user_id) do nothing;

    execute format(
      'update public.scores set %I = %I + $1, %I = %I + $2, updated_at = now() where porra_id = $3 and user_id = $4',
      v_col_pts, v_col_pts, v_col_corr, v_col_corr
    ) using v_pts, (case when v_correct then 1 else 0 end), v_pred.porra_id, v_pred.user_id;

  end loop;

  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. ACTUALIZAR VISTAS LEADERBOARD (filtradas por porra_id)
-- ────────────────────────────────────────────────────────────
drop view if exists public.leaderboard;
drop view if exists public.leaderboard_groups;
drop view if exists public.leaderboard_playoffs;

create or replace view public.leaderboard as
select
  s.porra_id,
  p.id                      as user_id,
  p.display_name,
  p.avatar_url,
  s.total_points,
  s.total_points_groups,
  s.total_points_playoffs,
  s.points_golden_boot,
  coalesce(s.correct_final, 0) +
  coalesce(s.correct_semi_final, 0) +
  coalesce(s.correct_quarter_final, 0)  as final_rounds_correct,
  (s.points_golden_boot = 15)           as golden_boot_correct,
  row_number() over (
    partition by s.porra_id
    order by
      s.total_points desc,
      (coalesce(s.correct_final, 0) + coalesce(s.correct_semi_final, 0) + coalesce(s.correct_quarter_final, 0)) desc,
      (s.points_golden_boot = 15) desc
  )                                     as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by s.porra_id, position;

create or replace view public.leaderboard_groups as
select
  s.porra_id,
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  s.total_points_groups               as points,
  s.correct_group                     as correct_predictions,
  row_number() over (
    partition by s.porra_id
    order by s.total_points_groups desc, s.correct_group desc
  )                                   as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by s.porra_id, position;

create or replace view public.leaderboard_playoffs as
select
  s.porra_id,
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  s.total_points_playoffs             as points,
  (coalesce(s.correct_round_of_32, 0) +
   coalesce(s.correct_round_of_16, 0) +
   coalesce(s.correct_quarter_final, 0) +
   coalesce(s.correct_semi_final, 0) +
   coalesce(s.correct_third_place, 0) +
   coalesce(s.correct_final, 0))      as correct_predictions,
  row_number() over (
    partition by s.porra_id
    order by
      s.total_points_playoffs desc,
      (coalesce(s.correct_final, 0) + coalesce(s.correct_semi_final, 0)) desc
  )                                   as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by s.porra_id, position;

-- ────────────────────────────────────────────────────────────
-- 9. RLS PARA LAS NUEVAS TABLAS
-- ────────────────────────────────────────────────────────────
alter table public.porras        enable row level security;
alter table public.porra_members enable row level security;

-- porras: lectura pública (para ver la lista al unirse)
create policy "Lectura pública de porras"
  on public.porras for select using (true);

create policy "Usuarios autenticados pueden crear porras"
  on public.porras for insert
  with check (auth.uid() = created_by);

create policy "Creator puede actualizar su porra"
  on public.porras for update
  using (auth.uid() = created_by);

create policy "Creator puede eliminar su porra"
  on public.porras for delete
  using (auth.uid() = created_by);

-- porra_members
create policy "Lectura pública de porra_members"
  on public.porra_members for select using (true);

create policy "Usuarios pueden unirse a porras"
  on public.porra_members for insert
  with check (auth.uid() = user_id);

create policy "Usuarios pueden salir o ser expulsados"
  on public.porra_members for delete
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.porras
      where id = porra_id and created_by = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 10. ACTUALIZAR RLS DE PREDICCIONES (añadir comprobación porra)
-- ────────────────────────────────────────────────────────────
drop policy if exists "Usuario crea sus propias predicciones" on public.predictions;
drop policy if exists "Usuario actualiza sus predicciones (no bloqueadas)" on public.predictions;

create policy "Usuario crea sus propias predicciones"
  on public.predictions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.porra_members pm
      where pm.porra_id = predictions.porra_id and pm.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at <= now()
    )
  );

create policy "Usuario actualiza sus predicciones (no bloqueadas)"
  on public.predictions for update
  using (auth.uid() = user_id and is_locked = false);

-- ────────────────────────────────────────────────────────────
-- 11. ACTUALIZAR RLS DE GOLDEN_BOOT (añadir comprobación porra)
-- ────────────────────────────────────────────────────────────
drop policy if exists "Usuario crea su Bota de Oro" on public.golden_boot_predictions;
drop policy if exists "Usuario actualiza su Bota de Oro (no bloqueada)" on public.golden_boot_predictions;

create policy "Usuario crea su Bota de Oro"
  on public.golden_boot_predictions for insert
  with check (
    auth.uid() = user_id
    and is_locked = false
    and exists (
      select 1 from public.porra_members pm
      where pm.porra_id = golden_boot_predictions.porra_id and pm.user_id = auth.uid()
    )
  );

create policy "Usuario actualiza su Bota de Oro (no bloqueada)"
  on public.golden_boot_predictions for update
  using (auth.uid() = user_id and is_locked = false);
