-- Discord user ID (snowflake numérico) por usuario, para @-mencionarlo en las
-- notificaciones de Discord que manda el sync al terminar partidos.
-- Lo rellena el admin desde el panel (pestaña "Usuarios"). Nullable: si está
-- vacío, las notificaciones usan el display_name en texto plano (sin ping).

alter table public.profiles
  add column if not exists discord_user_id text;

comment on column public.profiles.discord_user_id is
  'Discord user ID numérico (snowflake) para menciones <@id> en notificaciones. NULL = sin mención.';
