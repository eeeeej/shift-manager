-- Onboarding + Phase-A branding groundwork.
--   * create_organization: a platform superadmin creating a restaurant does not
--     become a member/employee of it (they already see every org); a self-serve
--     owner still becomes its first manager. Slug collisions raise a friendly error.
--   * Org admins may edit name/brand/positions/timezone but not slug or billing
--     columns (platform-only).

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
    insert into memberships (org_id, user_id, role) values (org, me.id, 'admin');
    insert into employees (org_id, name, email, user_id, role, positions)
    values (org, coalesce(me.full_name, me.email), me.email, me.id, 'admin', '{Manager}');
  end if;
  return org;
end;
$$;

create or replace function guard_org_platform_columns() returns trigger
language plpgsql as $$
begin
  if not is_superadmin() and (
       new.slug is distinct from old.slug
    or new.plan is distinct from old.plan
    or new.employee_limit is distinct from old.employee_limit
    or new.billing_status is distinct from old.billing_status
  ) then
    raise exception 'Only the platform administrator can change that setting';
  end if;
  if new.positions is null or cardinality(new.positions) = 0 then
    raise exception 'At least one position is required';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_guard on organizations;
create trigger organizations_guard before update on organizations
  for each row execute function guard_org_platform_columns();
