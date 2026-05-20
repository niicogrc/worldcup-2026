-- ============================================================
-- PORRA MUNDIAL 2026 — Supabase Schema
-- ============================================================
-- Convenciones:
--   · Todas las tablas tienen created_at / updated_at automáticos
--   · UUIDs como PKs (gen_random_uuid())
--   · RLS habilitado en todas las tablas con usuarios
--   · Timestamps siempre en UTC (timestamptz)
--   · Soft-delete con deleted_at donde aplica
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONES
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";         -- para crons nativos (opcional, Supabase lo incluye)
create extension if not exists "moddatetime";     -- para updated_at automático

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

-- Resultado posible de un partido (perspectiva del equipo local)
create type match_result as enum ('1', 'X', '2');

-- Estado del partido (espeja api-football status.short)
create type match_status as enum (
  'NS',    -- Not Started
  '1H',    -- First Half
  'HT',    -- Half Time
  '2H',    -- Second Half
  'ET',    -- Extra Time
  'P',     -- Penalty In Progress
  'FT',    -- Full Time (90 min) ← el que usamos para calcular
  'AET',   -- After Extra Time
  'PEN',   -- After Penalties
  'PST',   -- Postponed
  'CANC',  -- Cancelled
  'SUSP',  -- Suspended
  'ABD'    -- Abandoned
);

-- Fase del torneo
create type tournament_phase as enum (
  'group',          -- Fase de grupos
  'round_of_32',    -- Dieciseisavos
  'round_of_16',    -- Octavos
  'quarter_final',  -- Cuartos
  'semi_final',     -- Semifinales
  'third_place',    -- 3er y 4º puesto
  'final'           -- Final
);

-- Rol de usuario en la plataforma
create type user_role as enum ('participant', 'admin');

-- ────────────────────────────────────────────────────────────
-- FUNCIÓN HELPER: updated_at automático
-- ────────────────────────────────────────────────────────────
create or replace function handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES
--    Extiende auth.users de Supabase con datos de la porra
-- ────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  role          user_role not null default 'participant',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Trigger: sync display_name desde auth.users al hacer signup con OAuth
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. TEAMS
--    Seed: openfootball/worldcup.json (48 equipos)
-- ────────────────────────────────────────────────────────────
create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  api_football_id integer unique,              -- id en api-football para join
  name            text not null unique,        -- "Spain", "Brazil", etc.
  name_es         text,                        -- nombre en español (opcional)
  short_code      text,                        -- "ESP", "BRA" (FIFA code 3 letras)
  flag_url        text,                        -- URL de la bandera (TheSportsDB u otro)
  group_letter    char(1),                     -- 'A'–'L' (12 grupos)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger set_teams_updated_at
  before update on public.teams
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. MATCHES
--    104 partidos: 72 grupos + 32 eliminatorias
--    Sincronizado desde api-football cada hora via cron
-- ────────────────────────────────────────────────────────────
create table public.matches (
  id                  uuid primary key default gen_random_uuid(),
  api_football_id     integer unique not null,     -- fixture.id de api-football
  phase               tournament_phase not null,
  match_number        integer,                     -- 1–104, orden oficial FIFA
  group_letter        char(1),                     -- solo en fase de grupos
  home_team_id        uuid references public.teams(id),
  away_team_id        uuid references public.teams(id),
  kickoff_at          timestamptz not null,        -- UTC, para cerrar apuestas
  venue               text,                        -- nombre del estadio
  city                text,

  -- Resultado oficial (se rellena cuando status = 'FT' o posterior)
  status              match_status not null default 'NS',
  home_goals_ft       integer,                     -- goles a 90 min (score.fulltime)
  away_goals_ft       integer,
  home_goals_aet      integer,                     -- goles en prórroga (score.extratime)
  away_goals_aet      integer,
  home_goals_pen      integer,                     -- penales (score.penalty)
  away_goals_pen      integer,

  -- Resultado derivado a 90 min (calculado automáticamente por trigger)
  -- Es lo que cuenta para la porra: 1 = gana local, X = empate, 2 = gana visitante
  result_ft           match_result,

  -- Control de sync
  last_synced_at      timestamptz,
  synced_api_status   text,                        -- status raw de api-football

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint chk_different_teams check (home_team_id <> away_team_id),
  constraint chk_goals_non_negative check (
    (home_goals_ft is null or home_goals_ft >= 0) and
    (away_goals_ft is null or away_goals_ft >= 0)
  )
);

create index idx_matches_phase        on public.matches(phase);
create index idx_matches_kickoff      on public.matches(kickoff_at);
create index idx_matches_status       on public.matches(status);
create index idx_matches_api_id       on public.matches(api_football_id);
create index idx_matches_group        on public.matches(group_letter) where group_letter is not null;

-- Trigger: calcular result_ft automáticamente cuando se actualizan los goles
create or replace function compute_result_ft()
returns trigger language plpgsql as $$
begin
  if new.home_goals_ft is not null and new.away_goals_ft is not null
     and new.status in ('FT', 'AET', 'PEN') then
    new.result_ft := case
      when new.home_goals_ft > new.away_goals_ft then '1'
      when new.home_goals_ft < new.away_goals_ft then '2'
      else 'X'
    end::match_result;
  else
    new.result_ft := null;
  end if;
  return new;
end;
$$;

create trigger set_match_result_ft
  before insert or update on public.matches
  for each row execute procedure compute_result_ft();

create trigger set_matches_updated_at
  before update on public.matches
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 4. GROUP_STANDINGS
--    Clasificación en tiempo real de los 12 grupos
--    Sincronizado desde api-football
-- ────────────────────────────────────────────────────────────
create table public.group_standings (
  id              uuid primary key default gen_random_uuid(),
  group_letter    char(1) not null,
  position        integer not null,              -- 1–4 dentro del grupo
  team_id         uuid not null references public.teams(id),
  played          integer not null default 0,
  won             integer not null default 0,
  drawn           integer not null default 0,
  lost            integer not null default 0,
  goals_for       integer not null default 0,
  goals_against   integer not null default 0,
  goal_diff       integer generated always as (goals_for - goals_against) stored,
  points          integer not null default 0,
  form            text,                          -- "WWDLW" últimos 5
  updated_at      timestamptz not null default now(),

  unique (group_letter, team_id),
  unique (group_letter, position)
);

create trigger set_group_standings_updated_at
  before update on public.group_standings
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. GOLDEN_BOOT_PREDICTIONS
--    Apuesta al máximo goleador (Bota de Oro)
--    1 entrada por usuario, antes del 1er partido
-- ────────────────────────────────────────────────────────────
create table public.golden_boot_predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  player_name     text not null,                 -- nombre libre (ej. "Kylian Mbappé")
  team_id         uuid references public.teams(id),
  is_locked       boolean not null default false, -- true tras el pitido inicial del WC
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id)                               -- solo 1 apuesta por usuario
);

create trigger set_golden_boot_updated_at
  before update on public.golden_boot_predictions
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 6. PREDICTIONS
--    Predicciones 1/X/2 de cada partido por usuario
-- ────────────────────────────────────────────────────────────
create table public.predictions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  match_id        uuid not null references public.matches(id) on delete cascade,
  prediction      match_result not null,         -- '1', 'X' o '2'
  is_locked       boolean not null default false, -- true tras kickoff_at
  -- Resultado de la predicción (calculado por trigger tras actualizar match)
  is_correct      boolean,                       -- null hasta que haya result_ft
  points_awarded  integer,                       -- null hasta result_ft, luego 0 o N
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, match_id)
);

create index idx_predictions_user    on public.predictions(user_id);
create index idx_predictions_match   on public.predictions(match_id);
create index idx_predictions_correct on public.predictions(is_correct) where is_correct = true;

create trigger set_predictions_updated_at
  before update on public.predictions
  for each row execute procedure handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 7. SCORING RULES
--    Puntos por fase (referencia inmutable)
-- ────────────────────────────────────────────────────────────
create table public.scoring_rules (
  phase           tournament_phase primary key,
  points_correct  integer not null,
  points_wrong    integer not null default 0,
  max_points      integer not null,              -- máximo teórico si aciertas todos
  description     text
);

-- Seed fijo con las reglas de la porra
insert into public.scoring_rules (phase, points_correct, max_points, description) values
  ('group',         3,  216, '72 partidos × 3 pts'),
  ('round_of_32',   3,   48, '16 partidos × 3 pts'),
  ('round_of_16',   4,   32, '8 partidos × 4 pts'),
  ('quarter_final', 6,   24, '4 partidos × 6 pts'),
  ('semi_final',    8,   16, '2 partidos × 8 pts'),
  ('third_place',   5,    5, '1 partido × 5 pts'),
  ('final',        15,   15, '1 partido × 15 pts');

-- ────────────────────────────────────────────────────────────
-- 8. SCORES (LEADERBOARD)
--    Puntuación acumulada por usuario
--    Se recalcula automáticamente via trigger al resolver partidos
-- ────────────────────────────────────────────────────────────
create table public.scores (
  user_id                 uuid primary key references public.profiles(id) on delete cascade,

  -- Porra 1: Grupos
  points_group            integer not null default 0,
  correct_group           integer not null default 0,

  -- Porra 2: Playoffs (suma de todas las rondas eliminatorias)
  points_round_of_32      integer not null default 0,
  correct_round_of_32     integer not null default 0,
  points_round_of_16      integer not null default 0,
  correct_round_of_16     integer not null default 0,
  points_quarter_final    integer not null default 0,
  correct_quarter_final   integer not null default 0,
  points_semi_final       integer not null default 0,
  correct_semi_final      integer not null default 0,
  points_third_place      integer not null default 0,
  correct_third_place     integer not null default 0,
  points_final            integer not null default 0,
  correct_final           integer not null default 0,

  -- Bota de Oro
  points_golden_boot      integer not null default 0,  -- 0 o 15

  -- Totales calculados
  total_points_groups     integer generated always as (points_group) stored,
  total_points_playoffs   integer generated always as (
    points_round_of_32 + points_round_of_16 + points_quarter_final +
    points_semi_final  + points_third_place  + points_final
  ) stored,
  total_points            integer generated always as (
    points_group +
    points_round_of_32 + points_round_of_16 + points_quarter_final +
    points_semi_final  + points_third_place  + points_final +
    points_golden_boot
  ) stored,

  updated_at              timestamptz not null default now()
);

create index idx_scores_total     on public.scores(total_points desc);
create index idx_scores_groups    on public.scores(total_points_groups desc);
create index idx_scores_playoffs  on public.scores(total_points_playoffs desc);

create trigger set_scores_updated_at
  before update on public.scores
  for each row execute procedure handle_updated_at();

-- Inicializar scores cuando se crea un perfil
create or replace function initialize_user_scores()
returns trigger language plpgsql security definer as $$
begin
  insert into public.scores (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_profile_created_init_scores
  after insert on public.profiles
  for each row execute procedure initialize_user_scores();

-- ────────────────────────────────────────────────────────────
-- 9. TRIGGER: Calcular puntos cuando se resuelve un partido
--    Se activa cuando matches.result_ft pasa de NULL a un valor
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
  -- Solo actuar cuando result_ft acaba de establecerse
  if new.result_ft is null then return new; end if;
  if old.result_ft is not null and old.result_ft = new.result_ft then return new; end if;

  -- Obtener regla de puntuación de esta fase
  select * into v_rule from public.scoring_rules where phase = new.phase;
  if not found then return new; end if;

  -- Nombre de columnas dinámicas en scores
  v_col_pts  := 'points_'  || new.phase::text;
  v_col_corr := 'correct_' || new.phase::text;

  -- Iterar sobre todas las predicciones de este partido
  for v_pred in
    select * from public.predictions where match_id = new.id
  loop
    v_correct := (v_pred.prediction = new.result_ft);
    v_pts     := case when v_correct then v_rule.points_correct else 0 end;

    -- Actualizar predicción individual
    update public.predictions set
      is_correct    = v_correct,
      points_awarded = v_pts,
      is_locked      = true
    where id = v_pred.id;

    -- Actualizar leaderboard (upsert)
    insert into public.scores (user_id) values (v_pred.user_id)
    on conflict (user_id) do nothing;

    execute format(
      'update public.scores set %I = %I + $1, %I = %I + $2, updated_at = now() where user_id = $3',
      v_col_pts, v_col_pts, v_col_corr, v_col_corr
    ) using v_pts, (case when v_correct then 1 else 0 end), v_pred.user_id;

  end loop;

  return new;
end;
$$;

create trigger on_match_result_award_points
  after update of result_ft on public.matches
  for each row execute procedure award_points_on_result();

-- ────────────────────────────────────────────────────────────
-- 10. TRIGGER: Bloquear predicciones al kick-off
--     Evita que se modifiquen predicciones tras el inicio
-- ────────────────────────────────────────────────────────────
create or replace function lock_predictions_at_kickoff()
returns trigger language plpgsql as $$
begin
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

create trigger enforce_prediction_lock
  before update on public.predictions
  for each row execute procedure lock_predictions_at_kickoff();

-- ────────────────────────────────────────────────────────────
-- 11. SYNC LOG
--    Historial de sincronizaciones con api-football
--    Útil para debugging y auditoría
-- ────────────────────────────────────────────────────────────
create table public.sync_logs (
  id              uuid primary key default gen_random_uuid(),
  synced_at       timestamptz not null default now(),
  matches_updated integer not null default 0,
  matches_checked integer not null default 0,
  api_calls_used  integer not null default 0,
  error_message   text,
  duration_ms     integer,
  triggered_by    text default 'cron'   -- 'cron' | 'manual' | 'webhook'
);

create index idx_sync_logs_synced_at on public.sync_logs(synced_at desc);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas con datos de usuario
alter table public.profiles              enable row level security;
alter table public.predictions           enable row level security;
alter table public.golden_boot_predictions enable row level security;
alter table public.scores                enable row level security;

-- Tablas de referencia: lectura pública, escritura solo admin/service_role
alter table public.teams                 enable row level security;
alter table public.matches               enable row level security;
alter table public.group_standings       enable row level security;
alter table public.scoring_rules         enable row level security;
alter table public.sync_logs             enable row level security;

-- ── PROFILES ──
create policy "Cualquiera puede ver perfiles"
  on public.profiles for select using (true);

create policy "Usuario puede editar su propio perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── TEAMS ──
create policy "Lectura pública de equipos"
  on public.teams for select using (true);

-- ── MATCHES ──
create policy "Lectura pública de partidos"
  on public.matches for select using (true);

-- ── GROUP STANDINGS ──
create policy "Lectura pública de clasificaciones"
  on public.group_standings for select using (true);

-- ── SCORING RULES ──
create policy "Lectura pública de reglas"
  on public.scoring_rules for select using (true);

-- ── PREDICTIONS ──
create policy "Usuario ve sus propias predicciones"
  on public.predictions for select
  using (auth.uid() = user_id);

create policy "Usuarios ven predicciones de otros SOLO tras kick-off"
  on public.predictions for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at <= now()
    )
  );

create policy "Usuario crea sus propias predicciones"
  on public.predictions for insert
  with check (
    auth.uid() = user_id and
    not exists (
      select 1 from public.matches m
      where m.id = match_id and m.kickoff_at <= now()
    )
  );

create policy "Usuario actualiza sus predicciones (no bloqueadas)"
  on public.predictions for update
  using (auth.uid() = user_id and is_locked = false);

-- ── GOLDEN BOOT ──
create policy "Usuario ve su propia Bota de Oro"
  on public.golden_boot_predictions for select
  using (auth.uid() = user_id);

-- Todos ven Bota de Oro de otros tras inicio del torneo (11 jun 2026)
create policy "Todos ven Bota de Oro tras inicio del torneo"
  on public.golden_boot_predictions for select
  using (now() >= '2026-06-11 19:00:00+00'::timestamptz);

create policy "Usuario crea su Bota de Oro"
  on public.golden_boot_predictions for insert
  with check (auth.uid() = user_id and is_locked = false);

create policy "Usuario actualiza su Bota de Oro (no bloqueada)"
  on public.golden_boot_predictions for update
  using (auth.uid() = user_id and is_locked = false);

-- ── SCORES ──
create policy "Lectura pública del ranking"
  on public.scores for select using (true);

-- ── SYNC LOGS ──
create policy "Solo admins ven sync logs"
  on public.sync_logs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- VIEWS ÚTILES
-- ────────────────────────────────────────────────────────────

-- Ranking general con desempate según reglas
create or replace view public.leaderboard as
select
  p.id                      as user_id,
  p.display_name,
  p.avatar_url,
  s.total_points,
  s.total_points_groups,
  s.total_points_playoffs,
  s.points_golden_boot,
  -- Aciertos en rondas finales (criterio desempate 1)
  coalesce(s.correct_final, 0) +
  coalesce(s.correct_semi_final, 0) +
  coalesce(s.correct_quarter_final, 0)  as final_rounds_correct,
  -- Acertó la Bota de Oro (criterio desempate 2)
  (s.points_golden_boot = 15)           as golden_boot_correct,
  row_number() over (
    order by
      s.total_points desc,
      (coalesce(s.correct_final, 0) + coalesce(s.correct_semi_final, 0) + coalesce(s.correct_quarter_final, 0)) desc,
      (s.points_golden_boot = 15) desc
  )                                     as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by position;

-- Ranking solo Porra 1 (grupos)
create or replace view public.leaderboard_groups as
select
  p.id as user_id,
  p.display_name,
  p.avatar_url,
  s.total_points_groups               as points,
  s.correct_group                     as correct_predictions,
  row_number() over (
    order by s.total_points_groups desc, s.correct_group desc
  )                                   as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by position;

-- Ranking solo Porra 2 (playoffs)
create or replace view public.leaderboard_playoffs as
select
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
    order by
      s.total_points_playoffs desc,
      (coalesce(s.correct_final, 0) + coalesce(s.correct_semi_final, 0)) desc
  )                                   as position
from public.profiles p
join public.scores s on s.user_id = p.id
order by position;

-- Vista de predicciones de un partido con info del partido (para el frontend)
create or replace view public.match_predictions_summary as
select
  m.id                  as match_id,
  m.phase,
  m.kickoff_at,
  m.status,
  m.result_ft,
  ht.name               as home_team,
  at.name               as away_team,
  m.home_goals_ft,
  m.away_goals_ft,
  count(pr.id)          as total_predictions,
  count(case when pr.prediction = '1' then 1 end)  as count_1,
  count(case when pr.prediction = 'X' then 1 end)  as count_x,
  count(case when pr.prediction = '2' then 1 end)  as count_2,
  round(100.0 * count(case when pr.prediction = '1' then 1 end) / nullif(count(pr.id), 0), 1) as pct_1,
  round(100.0 * count(case when pr.prediction = 'X' then 1 end) / nullif(count(pr.id), 0), 1) as pct_x,
  round(100.0 * count(case when pr.prediction = '2' then 1 end) / nullif(count(pr.id), 0), 1) as pct_2
from public.matches m
left join public.teams ht on ht.id = m.home_team_id
left join public.teams at on at.id = m.away_team_id
left join public.predictions pr on pr.match_id = m.id
group by m.id, m.phase, m.kickoff_at, m.status, m.result_ft,
         ht.name, at.name, m.home_goals_ft, m.away_goals_ft;
