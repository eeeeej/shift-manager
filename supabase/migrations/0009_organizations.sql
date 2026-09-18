-- Multi-restaurant foundation: every tenant-owned row belongs to an
-- organization, and access is granted through memberships instead of a single
-- global profiles.role. Existing data is moved into one organization.
--
-- Access model after this migration:
--   * memberships(org_id, user_id, role) is the source of truth for who can see
--     an org and whether they manage it. An employee row with a linked login
--     keeps its membership in sync (role + link changes).
--   * profiles.is_superadmin marks platform operators: they may create
--     organizations and pass every org-level admin check.
--   * A login can belong to several organizations (one employee row per org).

-- ---------------------------------------------------------------------------
-- organizations + memberships + platform settings
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  timezone text not null default 'America/Chicago',
  positions text[] not null default '{Server,Bartender,"Bar Back",Host,Busser,Kitchen,Manager}',
  brand jsonb not null default '{}'::jsonb,
  plan text not null default 'free',
  employee_limit int,
  billing_status text not null default 'active',
  created_at timestamptz not null default now()
);

create table memberships (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'employee',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index memberships_user_idx on memberships (user_id);

create table platform_settings (
  key text primary key,
  value jsonb not null
);
insert into platform_settings (key, value) values ('allow_self_serve_orgs', 'false'::jsonb);

alter table profiles add column is_superadmin boolean not null default false;

-- ---------------------------------------------------------------------------
-- org_id on tenant tables, backfilled into a single organization
-- ---------------------------------------------------------------------------
alter table employees add column org_id uuid references organizations(id) on delete cascade;
alter table shifts add column org_id uuid references organizations(id) on delete cascade;
alter table shift_offers add column org_id uuid references organizations(id) on delete cascade;

do $$
declare
  org uuid;
begin
  if exists (select 1 from employees) or exists (select 1 from profiles) then
    insert into organizations (name, slug) values ('Francie''s', 'francies') returning id into org;
    update employees set org_id = org;
    update shifts set org_id = org;
    update shift_offers set org_id = org;
    -- every existing login keeps its access, with its current role
    insert into memberships (org_id, user_id, role)
      select org, id, role from profiles
      on conflict do nothing;
    -- the original owner (first profile) operates the platform
    update profiles set is_superadmin = true
      where id = (select id from profiles order by created_at limit 1);
  end if;
end $$;

alter table employees alter column org_id set not null;
alter table shifts alter column org_id set not null;
alter table shift_offers alter column org_id set not null;

create index employees_org_idx on employees (org_id);
create index shifts_org_date_idx on shifts (org_id, shift_date);
create index shift_offers_org_idx on shift_offers (org_id);

-- Email / login uniqueness is now per organization (one person can work at two).
alter table employees drop constraint employees_email_key;
alter table employees drop constraint employees_user_id_key;
create unique index employees_org_email_key on employees (org_id, lower(email)) where email is not null;
create unique index employees_org_user_key on employees (org_id, user_id) where user_id is not null;

-- ---------------------------------------------------------------------------
-- helpers (org-aware). Old policies and zero-arg helpers are dropped so nothing
-- can keep using the global role; new policies are created at the end.
-- ---------------------------------------------------------------------------
drop policy "profiles: read own or admin" on profiles;
drop policy "profiles: admin updates" on profiles;
drop policy "employees: staff read" on employees;
drop policy "employees: admin write" on employees;
drop policy "shifts: staff read" on shifts;
drop policy "shifts: admin write" on shifts;
drop policy "offers: read" on shift_offers;
drop policy "offers: offer own shift" on shift_offers;
drop policy "offers: cancel own / admin" on shift_offers;
drop policy "offers: admin delete" on shift_offers;
drop function is_admin();
drop function my_employee_id();

create or replace function is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from profiles where id = auth.uid()), false);
$$;

create or replace function is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_superadmin()
      or exists (select 1 from memberships where org_id = p_org and user_id = auth.uid());
$$;

create or replace function is_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_superadmin()
      or exists (select 1 from memberships where org_id = p_org and user_id = auth.uid() and role = 'admin');
$$;

create or replace function my_employee_id(p_org uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where org_id = p_org and user_id = auth.uid() limit 1;
$$;

grant execute on function is_superadmin() to authenticated;
grant execute on function is_member(uuid) to authenticated;
grant execute on function is_admin(uuid) to authenticated;
grant execute on function my_employee_id(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- signup + linking
-- ---------------------------------------------------------------------------
-- Invite-only: the email must be an active employee somewhere. (The bootstrap
-- exemption for the very first login is gone — orgs are created explicitly.)
create or replace function enforce_invited_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is null
     or not exists (
       select 1 from employees
       where active and lower(email) = lower(new.email)
     ) then
    raise exception 'This email has not been invited. Ask a manager to add you on the Team page with this address.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- New login: create the profile and link every employee row that carries this
-- email (one per org). Memberships follow from the employee trigger below.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  update employees set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

-- Employee row <-> membership: linking grants access at the employee's role;
-- unlinking (or deleting the row) revokes it.
drop trigger if exists on_employee_role on employees;
drop function if exists sync_profile_role();

create or replace function sync_membership() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.user_id is not null then
      delete from memberships where org_id = old.org_id and user_id = old.user_id;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.user_id is not null and old.user_id is distinct from new.user_id then
    delete from memberships where org_id = old.org_id and user_id = old.user_id;
  end if;
  if new.user_id is not null then
    insert into memberships (org_id, user_id, role) values (new.org_id, new.user_id, new.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end;
$$;

create trigger on_employee_membership
  after insert or update of role, user_id or delete on employees
  for each row execute function sync_membership();

-- Nobody can demote themselves (prevents locking every manager out).
create or replace function prevent_self_demotion() returns trigger
language plpgsql as $$
begin
  if old.role = 'admin' and new.role = 'employee' and old.user_id = auth.uid() and not is_superadmin() then
    raise exception 'You cannot remove your own manager access';
  end if;
  return new;
end;
$$;

-- profiles.role is no longer consulted anywhere; memberships replace it.
alter table profiles drop column role;

-- ---------------------------------------------------------------------------
-- offers: inherit the shift's org; actor lookup is org-scoped
-- ---------------------------------------------------------------------------
create or replace function set_offer_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from shifts where id = new.shift_id;
  if new.org_id is null then raise exception 'Shift not found'; end if;
  return new;
end;
$$;
create trigger shift_offers_org before insert on shift_offers
  for each row execute function set_offer_org();

create or replace function stamp_offer_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    new.resolved_at := now();
    if new.status = 'claimed' then
      select name into new.resolved_by_name from employees where id = new.claimed_by;
    else
      select coalesce(e.name, p.full_name, p.email) into new.resolved_by_name
      from profiles p left join employees e on e.user_id = p.id and e.org_id = new.org_id
      where p.id = auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create or replace function claim_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  o shift_offers%rowtype;
  s shifts%rowtype;
begin
  select * into o from shift_offers where id = p_offer_id for update;
  if not found or o.status <> 'open' then raise exception 'Offer is no longer open'; end if;
  me := my_employee_id(o.org_id);
  if me is null then raise exception 'Not linked to an employee'; end if;
  if o.offered_by = me then raise exception 'Cannot claim your own offer'; end if;
  if o.target_employee_id is not null and o.target_employee_id <> me then
    raise exception 'Offer was sent to someone else';
  end if;
  select * into s from shifts where id = o.shift_id for update;
  if not exists (select 1 from employees where id = me and s.position = any(positions)) then
    raise exception 'You do not hold the % position', s.position;
  end if;
  update shifts set employee_id = me, status = 'scheduled' where id = s.id;
  update shift_offers set status = 'claimed', claimed_by = me, resolved_at = now() where id = o.id;
  update shift_offers set status = 'cancelled', resolved_at = now()
    where shift_id = s.id and id <> o.id and status = 'open';
end;
$$;

-- ---------------------------------------------------------------------------
-- create_organization: platform admins always; everyone else only once the
-- allow_self_serve_orgs flag is on. The caller becomes the org's first
-- manager (membership + employee row).
-- ---------------------------------------------------------------------------
create or replace function create_organization(p_name text, p_slug text, p_positions text[] default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  org uuid;
  me profiles%rowtype;
  self_serve boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select coalesce((value)::boolean, false) into self_serve from platform_settings where key = 'allow_self_serve_orgs';
  if not is_superadmin() and not coalesce(self_serve, false) then
    raise exception 'Creating restaurants is not enabled for this account';
  end if;
  select * into me from profiles where id = auth.uid();
  insert into organizations (name, slug, positions)
  values (p_name, p_slug, coalesce(p_positions, '{Server,Bartender,"Bar Back",Host,Busser,Kitchen,Manager}'))
  returning id into org;
  insert into memberships (org_id, user_id, role) values (org, me.id, 'admin');
  insert into employees (org_id, name, email, user_id, role, positions)
  values (org, coalesce(me.full_name, me.email), me.email, me.id, 'admin', '{Manager}');
  return org;
end;
$$;
grant execute on function create_organization(text, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security, scoped by organization
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table platform_settings enable row level security;

create policy "orgs: members read" on organizations for select using (is_member(id));
create policy "orgs: admin update" on organizations for update
  using (is_admin(id)) with check (is_admin(id));

create policy "memberships: own or org admin read" on memberships for select
  using (user_id = auth.uid() or is_admin(org_id));
-- writes happen through triggers / create_organization (security definer)

create policy "settings: read" on platform_settings for select using (auth.uid() is not null);

create policy "profiles: read own or shared org admin" on profiles for select
  using (
    id = auth.uid()
    or is_superadmin()
    or exists (select 1 from memberships m where m.user_id = profiles.id and is_admin(m.org_id))
  );

create policy "employees: members read" on employees for select using (is_member(org_id));
create policy "employees: admin write" on employees for all
  using (is_admin(org_id)) with check (is_admin(org_id));

create policy "shifts: members read" on shifts for select using (is_member(org_id));
create policy "shifts: admin write" on shifts for all
  using (is_admin(org_id)) with check (is_admin(org_id));

create policy "offers: read" on shift_offers for select
  using (
    is_admin(org_id)
    or offered_by = my_employee_id(org_id)
    or target_employee_id = my_employee_id(org_id)
    or (
      target_employee_id is null
      and exists (
        select 1 from shifts s join employees e on e.id = my_employee_id(shift_offers.org_id)
        where s.id = shift_id and s.position = any(e.positions)
      )
    )
  );
create policy "offers: offer own shift" on shift_offers for insert
  with check (
    exists (
      select 1 from shifts s
      where s.id = shift_id
        and (is_admin(s.org_id)
             or (offered_by = my_employee_id(s.org_id) and s.employee_id = my_employee_id(s.org_id)))
    )
  );
create policy "offers: cancel own / admin" on shift_offers for update
  using (is_admin(org_id) or offered_by = my_employee_id(org_id))
  with check (is_admin(org_id) or offered_by = my_employee_id(org_id));
create policy "offers: admin delete" on shift_offers for delete using (is_admin(org_id));

-- push_subscriptions stay per-login (a device follows the person, who may be in
-- several orgs); the notify function resolves recipients through employees.org_id.
