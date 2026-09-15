-- Managers: an employee's role is the source of truth and is mirrored onto
-- the linked login (profiles.role). Admins promote/demote from the Team page.

alter table employees add column role app_role not null default 'employee';

-- Keep profiles.role in sync when an employee's role or link changes.
create or replace function sync_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then
    update profiles set role = new.role where id = new.user_id;
  end if;
  if tg_op = 'UPDATE' and old.user_id is not null and old.user_id is distinct from new.user_id then
    update profiles set role = 'employee' where id = old.user_id;
  end if;
  return new;
end;
$$;

create trigger on_employee_role
  after insert or update of role, user_id on employees
  for each row execute function sync_profile_role();

-- Nobody can demote themselves (prevents locking every admin out).
create or replace function prevent_self_demotion() returns trigger
language plpgsql as $$
begin
  if old.role = 'admin' and new.role = 'employee' and old.user_id = auth.uid() then
    raise exception 'You cannot remove your own manager access';
  end if;
  return new;
end;
$$;

create trigger employees_no_self_demotion
  before update of role on employees
  for each row execute function prevent_self_demotion();

-- New signups inherit the role of the employee row they link to.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
  emp_role app_role;
begin
  select not exists (select 1 from profiles) into is_first;
  select role into emp_role from employees where user_id is null and lower(email) = lower(new.email) limit 1;
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when is_first then 'admin'::app_role else coalesce(emp_role, 'employee'::app_role) end
  );
  update employees set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

-- Backfill: existing admins who are also employees.
update employees e set role = p.role from profiles p where p.id = e.user_id;
