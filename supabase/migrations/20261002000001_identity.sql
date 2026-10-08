-- Identity: the roles, the accounts and the branch an account belongs to.
--
-- Squashed 02-10-2026 from the first 41 migrations: files 1-5 build the database those 41
-- built, and nothing else. There are no seed rows.
--
-- L3_CM_OPERATOR and L4_SUPPLIER are retired (Foodiva and Chef House are partners, not users),
-- and so is L1_MANAGER (the Account Manager account): an enum value cannot be dropped, prod still
-- holds an L1_MANAGER profile, and L4_SUPPLIER is still the placeholder role of a new profile.
-- No RPC or policy lets a retired role in (files 2-5).

create type user_role as enum ('L1_OWNER', 'L2_BRANCH_ADMIN', 'L3_CM_OPERATOR', 'L4_SUPPLIER', 'L1_MANAGER');
create type location_kind as enum ('CENTRAL', 'CHEF_HOUSE', 'BRANCH', 'SUPPLIER_STORAGE', 'STEAK_PRODUCTION');
create type rice_model as enum ('EXTERNAL_COOKED', 'SELF_COOK');

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role         user_role not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table locations (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name_th    text not null,
  kind       location_kind not null,
  rice_model rice_model,
  is_active  boolean not null default true,
  -- rice model only means anything for a branch
  constraint locations_rice_model_branch_only
    check (rice_model is null or kind = 'BRANCH')
);

create table user_locations (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references profiles(id) on delete cascade,
  location_id        uuid not null references locations(id),
  -- BR12 / BR17 delegation: grants the act, not the data
  can_receive_central boolean not null default false,
  unique (profile_id, location_id)
);

-- RLS on, and nothing granted: a read is one of the policies below, and no client writes these
-- tables.
alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.user_locations enable row level security;
revoke all on public.profiles, public.locations, public.user_locations from anon, authenticated;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy user_locations_read_self on public.user_locations for select to authenticated using (profile_id = (select auth.uid()));
create policy locations_read_assigned on public.locations for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_active and p.role = 'L1_OWNER'::public.user_role)
  or exists (select 1 from public.user_locations ul where ul.profile_id = (select auth.uid()) and ul.location_id = locations.id)
);
grant select on public.profiles, public.user_locations, public.locations to authenticated;

create schema if not exists private;

-- A new auth user never makes itself an owner (APP-07): every new profile is inactive with the
-- placeholder role, and an owner activates it and assigns the role. The comment below is the
-- text prod holds; its 0032 is the old number of the migration that retired L3 / L4.
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
comment on function private.handle_new_user() is
  'New auth users get an inactive L4_SUPPLIER profile: a placeholder only (L3/L4 are retired, 0032). '
  'An owner assigns L1_OWNER / L2_BRANCH_ADMIN and activates it.';
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();
