-- 自分のプロフィール表示名を更新できるようにポリシーを追加
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 同一テナント内のプロフィールは相互に参照可能（担当者アサインの選択肢表示用）
drop policy if exists "profiles_select_tenant" on public.profiles;
create policy "profiles_select_tenant"
  on public.profiles for select
  using (tenant_id = public.current_tenant_id());
