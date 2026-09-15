-- Invite-only signups: a login can only be created for an email that a manager
-- has already added on the Team page (active employee). The very first signup
-- (the owner) is exempt so the project can be bootstrapped.
-- Applies to every provider (password, magic link, Google/Apple) because it
-- guards the auth.users insert itself.

create or replace function enforce_invited_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles) then
    return new; -- first user becomes the owner
  end if;
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

create trigger on_auth_user_invited
  before insert on auth.users
  for each row execute function enforce_invited_signup();
