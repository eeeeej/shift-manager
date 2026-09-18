-- Time off: staff request days off (any date; managers approve/deny), plus
-- recurring weekly unavailability set by managers on the employee. Both render
-- on the schedule and warn (not block) when scheduling over them.

-- Recurring unavailability: [{ "dow": 0-6, "start_min": 0, "end_min": 1440 }, ...]
-- A full day is 0..1440.
alter table employees add column unavailability jsonb not null default '[]'::jsonb;

create table time_off_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  start_min int check (start_min between 0 and 1440),     -- null = whole day
  end_min int check (end_min between 0 and 1440),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied', 'cancelled')),
  decision_note text,
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((start_min is null) = (end_min is null)),
  check (start_min is null or end_min > start_min)
);
create index time_off_requests_org_dates on time_off_requests (org_id, start_date, end_date);
alter table time_off_requests enable row level security;
alter publication supabase_realtime add table time_off_requests;

-- Everyone in the restaurant sees approved time off (it shows on the schedule);
-- staff also see their own requests in any state; managers see everything.
create policy "time_off: read" on time_off_requests for select
  using (is_admin(org_id) or employee_id = my_employee_id(org_id) or (is_member(org_id) and status = 'approved'));

-- Staff file their own requests (pending, whole rows only); managers may file on behalf of anyone.
create policy "time_off: create" on time_off_requests for insert
  with check (
    (is_admin(org_id) or (employee_id = my_employee_id(org_id) and status = 'pending'))
    and exists (select 1 from employees e where e.id = employee_id and e.org_id = time_off_requests.org_id)
  );

-- Staff may only withdraw their own pending request; managers decide.
create policy "time_off: staff cancel" on time_off_requests for update
  using (employee_id = my_employee_id(org_id) and status = 'pending')
  with check (employee_id = my_employee_id(org_id) and status = 'cancelled');
create policy "time_off: admin update" on time_off_requests for update
  using (is_admin(org_id)) with check (is_admin(org_id));
create policy "time_off: admin delete" on time_off_requests for delete using (is_admin(org_id));

-- Stamp who decided, when.
create or replace function stamp_time_off_decision() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('approved', 'denied') and old.status is distinct from new.status then
    new.decided_by := auth.uid();
    new.decided_at := now();
  end if;
  return new;
end;
$$;
create trigger time_off_decision before update of status on time_off_requests
  for each row execute function stamp_time_off_decision();

-- Push: new request → managers; decision → the employee.
create trigger time_off_notify
  after insert or update of status on time_off_requests
  for each row execute function notify_webhook();
