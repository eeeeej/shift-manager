-- Managers see whether each staff member's login is confirmed and when they were last active.
create or replace function account_status(p_org uuid)
returns table (employee_id uuid, confirmed_at timestamptz, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id,
         u.email_confirmed_at,
         greatest(u.last_sign_in_at, (select max(s.refreshed_at) from auth.sessions s where s.user_id = u.id))
  from employees e
  join auth.users u on u.id = e.user_id
  where e.org_id = p_org
    and is_admin(p_org);
$$;
grant execute on function account_status(uuid) to authenticated;
