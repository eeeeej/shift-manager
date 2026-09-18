-- Publish weeks: shifts in a future week are drafts (managers only) until the
-- week is published. Weeks up to and including the current one always count as
-- published so nothing ever disappears from staff. Publishing is "through a
-- week": every draft week from the current one up to the chosen week goes live
-- at once, with one "Schedule posted" notification per affected employee.

create table published_weeks (
  org_id uuid not null references organizations(id) on delete cascade,
  week_start date not null,               -- Sunday
  published_at timestamptz not null default now(),
  published_by uuid references profiles(id) on delete set null,
  primary key (org_id, week_start)
);
alter table published_weeks enable row level security;
create policy "published: members read" on published_weeks for select using (is_member(org_id));
alter publication supabase_realtime add table published_weeks;

-- Sunday-start week, matching startOfWeek() in the client.
create or replace function week_start(d date) returns date
language sql immutable as $$
  select d - extract(dow from d)::int;
$$;

create or replace function is_week_published(p_org uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select week_start(d) <= week_start(current_date)
      or exists (select 1 from published_weeks where org_id = p_org and week_start = week_start(d));
$$;
grant execute on function week_start(date) to authenticated;
grant execute on function is_week_published(uuid, date) to authenticated;

-- Staff only see shifts (and offers on shifts) in published weeks.
drop policy "shifts: members read" on shifts;
create policy "shifts: members read" on shifts for select
  using (is_admin(org_id) or (is_member(org_id) and is_week_published(org_id, shift_date)));

drop policy "offers: read" on shift_offers;
create policy "offers: read" on shift_offers for select
  using (
    is_admin(org_id)
    or (
      exists (select 1 from shifts s where s.id = shift_id and is_week_published(s.org_id, s.shift_date))
      and (
        offered_by = my_employee_id(org_id)
        or target_employee_id = my_employee_id(org_id)
        or (
          target_employee_id is null
          and exists (
            select 1 from shifts s join employees e on e.id = my_employee_id(shift_offers.org_id)
            where s.id = shift_id and s.position = any(e.positions)
          )
        )
      )
    )
  );

-- Publish every draft week from the current week through p_through's week.
-- Returns the week starts that were newly published.
create or replace function publish_weeks(p_org uuid, p_through date) returns date[]
language plpgsql security definer set search_path = public, extensions as $$
declare
  first_week date := week_start(current_date);
  last_week date := week_start(p_through);
  added date[];
  secret text;
begin
  if not is_admin(p_org) then raise exception 'Only managers can publish the schedule'; end if;
  if last_week < first_week then return '{}'; end if;

  with ins as (
    insert into published_weeks (org_id, week_start, published_by)
    select p_org, w::date, auth.uid()
    from generate_series(first_week, last_week, interval '7 days') w
    on conflict do nothing
    returning week_start
  )
  select coalesce(array_agg(week_start order by week_start), '{}') into added from ins;

  -- The current week was already visible; only announce genuinely new weeks.
  added := array(select w from unnest(added) w where w > week_start(current_date));
  if cardinality(added) = 0 then return added; end if;

  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_webhook_secret' limit 1;
  if secret is not null then
    perform net.http_post(
      url := 'https://wqvvmmcteevirvcqjevb.supabase.co/functions/v1/notify',
      body := jsonb_build_object(
        'type', 'PUBLISH',
        'table', 'published_weeks',
        'record', jsonb_build_object(
          'org_id', p_org,
          'from_date', added[1],
          'through_date', added[cardinality(added)] + 6,
          'published_by', auth.uid()
        ),
        'old_record', null
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
      timeout_milliseconds := 5000
    );
  end if;
  return added;
end;
$$;
grant execute on function publish_weeks(uuid, date) to authenticated;

-- Backfill: every week that already has shifts is published (no publisher) —
-- staff could already see them. Only weeks built from now on start as drafts.
insert into published_weeks (org_id, week_start)
select distinct org_id, week_start(shift_date)
from shifts
on conflict do nothing;
