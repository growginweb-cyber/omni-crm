-- リテンションシナリオ（LINE複数メッセージブロック）を保存するためのカラム
alter table public.broadcast_templates add column if not exists messages_json jsonb;
