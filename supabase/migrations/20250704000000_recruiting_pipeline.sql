-- 人材業界向け: 選考パイプライン・滞留検知フォロー・担当者アサイン・外部連携基盤

-- 担当者表示名（プロフィール）
alter table public.profiles add column if not exists display_name text;

-- 顧客（候補者）に選考ステージ・担当者・最終接触日時・スコアを追加
alter table public.customers add column if not exists pipeline_stage text not null default '会員登録';
alter table public.customers add column if not exists assigned_to uuid references public.profiles (id) on delete set null;
alter table public.customers add column if not exists last_contacted_at timestamptz;
alter table public.customers add column if not exists engagement_score integer not null default 0;

create index if not exists idx_customers_pipeline_stage on public.customers (tenant_id, pipeline_stage);
create index if not exists idx_customers_assigned_to on public.customers (assigned_to);

-- シナリオに滞留検知トリガー条件を追加（例: 会員登録のまま3日間放置）
alter table public.step_scenario_defs add column if not exists trigger_stage text;
alter table public.step_scenario_defs add column if not exists trigger_days integer;

-- 外部CRM/ATS連携設定（接続先未定のため汎用スキーマ）
create table if not exists public.integration_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'custom',
  webhook_url text,
  enabled boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_integration_configs_tenant_id on public.integration_configs (tenant_id);

alter table public.integration_configs enable row level security;
create policy "tenant isolation integration_configs" on public.integration_configs
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
