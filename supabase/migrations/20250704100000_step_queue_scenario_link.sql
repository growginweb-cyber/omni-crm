-- 滞留検知シナリオが発行したキューを追跡するための紐付け
alter table public.step_broadcast_queues add column if not exists scenario_def_id uuid references public.step_scenario_defs (id) on delete set null;
create index if not exists idx_step_broadcast_queues_scenario_def_id on public.step_broadcast_queues (scenario_def_id);
