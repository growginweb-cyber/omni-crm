-- テナント招待（メールアドレス単位で既存テナントへの参加を許可）
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);
create index if not exists idx_tenant_invites_email on public.tenant_invites (email) where accepted = false;

alter table public.tenant_invites enable row level security;
create policy "tenant isolation tenant_invites" on public.tenant_invites
  for all using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- 新規ユーザー作成時、招待テーブルにマッチするメールがあれば
-- 新規テナントを作らずそのテナントに参加させる
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
  matched_invite record;
begin
  select * into matched_invite
  from public.tenant_invites
  where email = new.email and accepted = false
  limit 1;

  if matched_invite.id is not null then
    insert into public.profiles (id, tenant_id)
    values (new.id, matched_invite.tenant_id);

    update public.tenant_invites set accepted = true where id = matched_invite.id;
  else
    insert into public.tenants (name)
    values (coalesce(new.raw_user_meta_data ->> 'workspace_name', 'My Workspace'))
    returning id into new_tenant_id;

    insert into public.profiles (id, tenant_id)
    values (new.id, new_tenant_id);
  end if;

  return new;
end;
$$;

-- 依頼のあった2名を、growgin.web@gmail.com が所属するテナントへ招待
insert into public.tenant_invites (tenant_id, email)
select p.tenant_id, e.email
from public.profiles p
join auth.users u on u.id = p.id
cross join (values ('yuma.takaba@danch.site'), ('riki.takano@danch.site')) as e(email)
where u.email = 'growgin.web@gmail.com'
on conflict (tenant_id, email) do nothing;
