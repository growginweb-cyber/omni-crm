-- タググループ（親）とタグ定義（子）
create table if not exists public.tag_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_tag_groups_tenant_id on public.tag_groups (tenant_id, sort_order);

create table if not exists public.tag_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  group_id uuid references public.tag_groups (id) on delete set null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);
create index if not exists idx_tag_definitions_tenant_id on public.tag_definitions (tenant_id, group_id);

alter table public.tag_groups enable row level security;
alter table public.tag_definitions enable row level security;

create policy "tenant isolation tag_groups" on public.tag_groups
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant isolation tag_definitions" on public.tag_definitions
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
