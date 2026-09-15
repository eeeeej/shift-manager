# Shift Manager

Scheduling app for a small bar/restaurant: weekly timeline schedule, team management, and tracked shift trades between coworkers.

## Run locally

```bash
npm install
npm run dev
```

Without Supabase env vars the app runs in **demo mode**: data is seeded from the Wait Staff spreadsheet and persisted in LocalStorage (use the `demo` badge in the header to reset).

Demo accounts (password `password`):

- Admin: `owner@example.com`
- Employees: `<firstname>@example.com` (e.g. `tanielle@example.com`, `eddie@example.com`, `ashly@example.com`)
- Register OTP: `123456`

## Supabase

1. Create a project and apply `supabase/migrations/*.sql` in order (tables, RLS, `claim_offer` RPC, email-linking triggers, manager role sync). The first account to sign up becomes an admin; promote further managers from the Team page.
2. Enable Email (with OTP confirmation), Google and optionally Apple providers in Auth.
3. Add a `.env.local`:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Promote an admin: `update public.profiles set role = 'admin' where email = '<you>';`

Employees are linked to login accounts by matching email (on signup and on employee edit).

## Scripts

- `npm run dev` – Vite dev server
- `npm run build` – typecheck + production build
- `npm run lint` – oxlint
