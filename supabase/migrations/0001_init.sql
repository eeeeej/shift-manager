-- Shift Manager schema
-- Roles: admin (owner/manager) and employee. Everyone else has no access.

create extension if not exists pgcrypto;

create type app_role as enum ('admin', 'employee');
create type shift_status as enum ('scheduled', 'open');
create type offer_status as enum ('open', 'claimed', 'cancelled');

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role app_role not null default 'employee',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------------
create table employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  positions text[] not null default '{}',
  email text unique,
  phone text,
  user_id uuid unique references auth.users(id) on delete set null,
  color text not null default '#3b82f6',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- shifts
-- ---------------------------------------------------------------------------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete set null,
  position text not null,
  shift_date date not null,
  start_min int not null check (start_min >= 0 and start_min < 1440),
  end_min int not null check (end_min > start_min and end_min <= 1440),
  notes text,
  status shift_status not null default 'scheduled',
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shifts_date_idx on shifts (shift_date);
create index shifts_employee_idx on shifts (employee_id);

-- ---------------------------------------------------------------------------
-- shift_offers: a shift put up for trade
-- ---------------------------------------------------------------------------
create table shift_offers (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shifts(id) on delete cascade,
  offered_by uuid not null references employees(id) on delete cascade,
  target_employee_id uuid references employees(id) on delete set null, -- null = broadcast to same position
  claimed_by uuid references employees(id) on delete set null,
  status offer_status not null default 'open',
  message text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index shift_offers_shift_idx on shift_offers (shift_id);
create index shift_offers_status_idx on shift_offers (status);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function my_employee_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from employees where user_id = auth.uid() limit 1;
$$;

-- Create a profile for each new auth user and link them to an employee row by email.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from profiles) into is_first;
  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    case when is_first then 'admin'::app_role else 'employee'::app_role end
  );
  update employees set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- When an admin adds/edits an employee email, link an existing user immediately.
create or replace function link_employee_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.email is not null then
    select id into new.user_id from auth.users where lower(email) = lower(new.email) limit 1;
  end if;
  return new;
end;
$$;

create trigger on_employee_email
  before insert or update of email on employees
  for each row execute function link_employee_user();

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger shifts_touch before update on shifts for each row execute function touch_updated_at();

-- Claim an open offer atomically: reassign the shift, close the offer,
-- cancel any other open offers on the same shift.
create or replace function claim_offer(p_offer_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := my_employee_id();
  o shift_offers%rowtype;
  s shifts%rowtype;
begin
  if me is null then raise exception 'Not linked to an employee'; end if;
  select * into o from shift_offers where id = p_offer_id for update;
  if not found or o.status <> 'open' then raise exception 'Offer is no longer open'; end if;
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
-- Row level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table employees enable row level security;
alter table shifts enable row level security;
alter table shift_offers enable row level security;

create policy "profiles: read own or admin" on profiles for select
  using (id = auth.uid() or is_admin());
create policy "profiles: admin updates" on profiles for update using (is_admin());

-- Employees: any signed-in staff member can read the roster (needed to show names on the schedule).
create policy "employees: staff read" on employees for select
  using (is_admin() or my_employee_id() is not null);
create policy "employees: admin write" on employees for all
  using (is_admin()) with check (is_admin());

create policy "shifts: staff read" on shifts for select
  using (is_admin() or my_employee_id() is not null);
create policy "shifts: admin write" on shifts for all
  using (is_admin()) with check (is_admin());

-- Offers: visible to admins, the offerer, the target, or anyone sharing the shift's position (broadcast).
create policy "offers: read" on shift_offers for select
  using (
    is_admin()
    or offered_by = my_employee_id()
    or target_employee_id = my_employee_id()
    or (
      target_employee_id is null
      and exists (
        select 1 from shifts s join employees e on e.id = my_employee_id()
        where s.id = shift_id and s.position = any(e.positions)
      )
    )
  );
create policy "offers: offer own shift" on shift_offers for insert
  with check (
    is_admin()
    or (offered_by = my_employee_id()
        and exists (select 1 from shifts s where s.id = shift_id and s.employee_id = my_employee_id()))
  );
create policy "offers: cancel own / admin" on shift_offers for update
  using (is_admin() or offered_by = my_employee_id())
  with check (is_admin() or offered_by = my_employee_id());
create policy "offers: admin delete" on shift_offers for delete using (is_admin());

grant execute on function claim_offer(uuid) to authenticated;
grant execute on function is_admin() to authenticated;
grant execute on function my_employee_id() to authenticated;
