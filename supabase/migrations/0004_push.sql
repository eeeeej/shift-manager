-- Web Push: per-device subscriptions + database webhooks that call the `notify`
-- Edge Function when offers/shifts change. The function decides who to tell.

create extension if not exists pg_net with schema extensions;

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;
create policy "push: own rows" on push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Webhook: POST the changed row to the notify function. The shared secret lives
-- in Vault (name 'notify_webhook_secret'); if it isn't set, do nothing.
-- ---------------------------------------------------------------------------
create or replace function notify_webhook() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  secret text;
  payload jsonb;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'notify_webhook_secret' limit 1;
  if secret is null then return null; end if;

  payload := jsonb_build_object(
    'type', tg_op,
    'table', tg_table_name,
    'record', case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
  );

  perform net.http_post(
    url := 'https://wqvvmmcteevirvcqjevb.supabase.co/functions/v1/notify',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    timeout_milliseconds := 5000
  );
  return null;
end;
$$;

create trigger shift_offers_notify
  after insert or update of status on shift_offers
  for each row execute function notify_webhook();

-- Only fire when something the employee would care about changed.
create trigger shifts_notify
  after update of employee_id, shift_date, start_min, end_min on shifts
  for each row
  when (
    old.employee_id is distinct from new.employee_id
    or old.shift_date is distinct from new.shift_date
    or old.start_min is distinct from new.start_min
    or old.end_min is distinct from new.end_min
  )
  execute function notify_webhook();
