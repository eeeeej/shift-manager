-- Stream row changes to signed-in clients (RLS still applies per subscriber).
alter publication supabase_realtime add table shifts, shift_offers, employees;
