-- Tracking events for open/click measurement

create table if not exists public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  broadcast_task_id uuid references public.broadcast_tasks (id) on delete set null,
  broadcast_queue_id uuid references public.broadcast_queues (id) on delete set null,
  step_queue_id uuid references public.step_broadcast_queues (id) on delete set null,
  event_type text not null check (event_type in ('open', 'click')),
  delivery_channel text not null check (delivery_channel in ('LINE', 'Email', 'SMS')),
  url text,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index idx_tracking_events_tenant on public.tracking_events (tenant_id, created_at desc);
create index idx_tracking_events_task on public.tracking_events (broadcast_task_id, event_type);
create index idx_tracking_events_customer on public.tracking_events (customer_id, event_type);

alter table public.tracking_events enable row level security;

create policy "tracking_events_tenant_isolation"
  on public.tracking_events for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Allow anonymous insert for tracking pixel/redirect (Edge Function uses service role)
create policy "tracking_events_anon_insert"
  on public.tracking_events for insert
  to anon
  with check (true);

-- RPC to atomically increment a counter column on broadcast_tasks
create or replace function public.increment_counter(
  table_name text,
  row_id uuid,
  column_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if table_name = 'broadcast_tasks' and column_name in ('opened_count', 'clicked_count') then
    execute format(
      'update public.broadcast_tasks set %I = %I + 1 where id = $1',
      column_name, column_name
    ) using row_id;
  end if;
end;
$$;
