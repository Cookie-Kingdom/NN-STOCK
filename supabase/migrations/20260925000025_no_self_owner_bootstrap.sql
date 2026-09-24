-- APP-07: a new auth user no longer bootstraps itself into an active L1_OWNER when
-- profiles is empty. Every new profile is inactive with the lowest role
-- (L4_SUPPLIER); an owner or admin activates it and assigns the role.
create or replace function private.handle_new_user() returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
declare chosen_name text;
begin
  chosen_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'ผู้ใช้งาน');
  insert into public.profiles (id, display_name, role, is_active)
  values (new.id, chosen_name, 'L4_SUPPLIER'::public.user_role, false)
  on conflict (id) do nothing;
  return new;
end; $$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
