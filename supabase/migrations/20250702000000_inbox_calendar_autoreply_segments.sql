-- 受信トレイ（会話・メッセージ）
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete cascade,
  channel text not null default 'LINE',
  status text not null default '未対応',
  last_message_at timestamptz not null default now(),
  unread boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_tenant_id on public.conversations (tenant_id, last_message_at desc);

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null default 'inbound', -- inbound | outbound
  channel text not null default 'LINE',
  content text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists idx_inbox_messages_conversation_id on public.inbox_messages (conversation_id, created_at);

-- カレンダー（手動予定。配信予定はbroadcast_tasks/step_broadcast_queuesから集約表示）
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  event_date date not null,
  event_type text not null default '予約', -- 予約 | LINE | メール | SMS
  created_at timestamptz not null default now()
);
create index if not exists idx_calendar_events_tenant_id on public.calendar_events (tenant_id, event_date);

-- 自動応答ルール
create table if not exists public.autoreply_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  keyword text not null,
  match_type text not null default '部分一致', -- 完全一致 | 部分一致
  reply_content text not null default '',
  channel text not null default 'LINE',
  hit_count integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_autoreply_rules_tenant_id on public.autoreply_rules (tenant_id);

-- 保存済みセグメント（タグ・セグメント条件の保存）
create table if not exists public.saved_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  segment_filter text,
  tag_filter text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_saved_segments_tenant_id on public.saved_segments (tenant_id);

alter table public.conversations enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.calendar_events enable row level security;
alter table public.autoreply_rules enable row level security;
alter table public.saved_segments enable row level security;

create policy "tenant isolation conversations" on public.conversations
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation inbox_messages" on public.inbox_messages
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation calendar_events" on public.calendar_events
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation autoreply_rules" on public.autoreply_rules
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation saved_segments" on public.saved_segments
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.inbox_messages;
