-- Guarda el ID del mensaje de Discord enviado en cada sync.
-- Permite borrar y reenviar la notificación desde el panel admin.
alter table public.sync_logs add column if not exists discord_message_id text;
