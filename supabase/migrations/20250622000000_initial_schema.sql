-- AI OMNI CRM: initial schema

create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default Workspace',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  email text,
  phone text,
  line_uid text not null default '未連携',
  segment text not null default '未診断',
  created_at timestamptz not null default now()
);

create table if not exists public.survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  campaign_id uuid not null references public.survey_campaigns (id) on delete cascade,
  question_text text not null,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.survey_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions (id) on delete cascade,
  choice_text text not null,
  assigned_segment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcast_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  content text not null,
  image_url text,
  flex_json jsonb,
  email_subject text,
  delivery_channel text not null check (delivery_channel in ('LINE', 'Email', 'SMS')),
  target_segment text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcast_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id uuid references public.broadcast_templates (id) on delete set null,
  title text not null,
  scheduled_at timestamptz not null,
  status text not null default '予約中',
  delivery_channel text not null check (delivery_channel in ('LINE', 'Email', 'SMS')),
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.broadcast_queues (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.broadcast_tasks (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default '未送信',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.step_broadcast_queues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  step_number integer not null,
  delivery_channel text not null check (delivery_channel in ('LINE', 'Email', 'SMS')),
  template_id uuid references public.broadcast_templates (id) on delete set null,
  scheduled_at timestamptz not null,
  status text not null default '未送信',
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_tenant_id on public.customers (tenant_id);
create index if not exists idx_customers_segment on public.customers (tenant_id, segment);
create index if not exists idx_step_broadcast_queues_pending
  on public.step_broadcast_queues (status, scheduled_at)
  where status = '未送信';

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.survey_campaigns enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_choices enable row level security;
alter table public.broadcast_templates enable row level security;
alter table public.broadcast_tasks enable row level security;
alter table public.broadcast_queues enable row level security;
alter table public.step_broadcast_queues enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "customers_tenant_isolation"
  on public.customers for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "survey_campaigns_tenant_isolation"
  on public.survey_campaigns for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "survey_questions_tenant_isolation"
  on public.survey_questions for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "survey_choices_tenant_isolation"
  on public.survey_choices for all
  using (
    exists (
      select 1
      from public.survey_questions q
      where q.id = survey_choices.question_id
        and q.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1
      from public.survey_questions q
      where q.id = survey_choices.question_id
        and q.tenant_id = public.current_tenant_id()
    )
  );

create policy "broadcast_templates_tenant_isolation"
  on public.broadcast_templates for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "broadcast_tasks_tenant_isolation"
  on public.broadcast_tasks for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "broadcast_queues_tenant_isolation"
  on public.broadcast_queues for all
  using (
    exists (
      select 1
      from public.broadcast_tasks t
      where t.id = broadcast_queues.task_id
        and t.tenant_id = public.current_tenant_id()
    )
  )
  with check (
    exists (
      select 1
      from public.broadcast_tasks t
      where t.id = broadcast_queues.task_id
        and t.tenant_id = public.current_tenant_id()
    )
  );

create policy "step_broadcast_queues_tenant_isolation"
  on public.step_broadcast_queues for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
begin
  insert into public.tenants (name)
  values (coalesce(new.raw_user_meta_data ->> 'workspace_name', 'My Workspace'))
  returning id into new_tenant_id;

  insert into public.profiles (id, tenant_id)
  values (new.id, new_tenant_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
