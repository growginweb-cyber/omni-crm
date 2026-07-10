-- シナリオ格納庫（複数シナリオ・ステップの永続化）
create table if not exists public.step_scenario_defs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  trigger_type text not null default '友だち追加',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_step_scenario_defs_tenant_id on public.step_scenario_defs (tenant_id);

create table if not exists public.step_scenario_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scenario_def_id uuid not null references public.step_scenario_defs (id) on delete cascade,
  step_number integer not null default 1,
  delivery_channel text not null default 'LINE',
  template_id uuid references public.broadcast_templates (id) on delete set null,
  delay_minutes integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_step_scenario_items_scenario_id on public.step_scenario_items (scenario_def_id, step_number);

alter table public.step_scenario_defs enable row level security;
alter table public.step_scenario_items enable row level security;

create policy "tenant isolation step_scenario_defs" on public.step_scenario_defs
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation step_scenario_items" on public.step_scenario_items
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
