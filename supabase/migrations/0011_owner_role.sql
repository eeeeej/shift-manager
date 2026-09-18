-- Owner role: sits above manager (admin). Owners edit restaurant settings and
-- decide who is a manager/owner; managers keep schedule, offers and staff.
--
-- NOTE: a new enum value cannot be used in the transaction that adds it, so
-- run the first statement on its own (or let `supabase db push` run this file
-- without a wrapping transaction).
alter type app_role add value if not exists 'owner';

-- Managers and owners both count as admins everywhere is_admin() is used.
create or replace function is_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_superadmin()
      or exists (select 1 from memberships where org_id = p_org and user_id = auth.uid() and role in ('admin', 'owner'));
$$;

create or replace function is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_superadmin()
      or exists (select 1 from memberships where org_id = p_org and user_id = auth.uid() and role = 'owner');
$$;
grant execute on function is_owner(uuid) to authenticated;

-- Restaurant settings are owner-only.
drop policy "orgs: admin update" on organizations;
create policy "orgs: owner update" on organizations for update
  using (is_owner(id)) with check (is_owner(id));

-- Role changes involving manager/owner, and any edit of an owner's row, need an owner.
create or replace function prevent_self_demotion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.user_id = auth.uid() and not is_superadmin()
     and (old.role = 'owner' and new.role <> 'owner' or old.role = 'admin' and new.role = 'employee') then
    raise exception 'You cannot remove your own manager access';
  end if;
  if auth.uid() is not null and not is_owner(new.org_id) then
    if new.role = 'owner' or (tg_op = 'UPDATE' and old.role = 'owner') then
      raise exception 'Only an owner can change owners';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Only an owner can change who is a manager';
    end if;
    if tg_op = 'INSERT' and new.role <> 'employee' then
      raise exception 'Only an owner can add managers';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists employees_no_self_demotion on employees;
drop trigger if exists employees_role_guard on employees;
create trigger employees_role_guard before insert or update on employees
  for each row execute function prevent_self_demotion();

create or replace function prevent_owner_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'owner' and auth.uid() is not null and not is_owner(old.org_id) then
    raise exception 'Only an owner can remove an owner';
  end if;
  return old;
end;
$$;
drop trigger if exists employees_owner_delete on employees;
create trigger employees_owner_delete before delete on employees
  for each row execute function prevent_owner_delete();

-- Self-serve creators own their restaurant.
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
  if length(trim(p_name)) < 2 then raise exception 'Name is too short'; end if;
  if exists (select 1 from organizations where slug = p_slug) then
    raise exception 'The short name "%" is already taken', p_slug;
  end if;
  select * into me from profiles where id = auth.uid();
  insert into organizations (name, slug, positions)
  values (trim(p_name), p_slug, coalesce(p_positions, '{Server,Bartender,"Bar Back",Host,Busser,Kitchen,Manager}'))
  returning id into org;
  if not is_superadmin() then
    insert into memberships (org_id, user_id, role) values (org, me.id, 'owner');
    insert into employees (org_id, name, email, user_id, role, positions)
    values (org, coalesce(me.full_name, me.email), me.email, me.id, 'owner', '{Manager}');
  end if;
  return org;
end;
$$;

-- Francie's owners.
update employees set role = 'owner'
where lower(email) in ('foltzt@hotmail.com', 'dh.eck.francies@gmail.com') and role = 'admin';
