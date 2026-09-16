-- Record who resolved an offer (name snapshot, readable by all offer viewers).
alter table shift_offers add column resolved_by_name text;

create or replace function stamp_offer_actor() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and new.status <> 'open' then
    new.resolved_at := now();
    if new.status = 'claimed' then
      select name into new.resolved_by_name from employees where id = new.claimed_by;
    else
      select coalesce(e.name, p.full_name, p.email) into new.resolved_by_name
      from profiles p left join employees e on e.user_id = p.id
      where p.id = auth.uid();
    end if;
  end if;
  return new;
end;
$$;

create trigger shift_offers_actor before update of status on shift_offers
  for each row execute function stamp_offer_actor();
