# Multi-restaurant plan (draft for product-owner review)

Goal: one deployment (shift-mgr.netlify.app + one Supabase project) serving many independent restaurants, each with its own staff, schedule, offers, notifications and light branding. Francie's keeps working unchanged throughout.

## 1. Data model

New tables

| table | columns | notes |
|---|---|---|
| `organizations` | `id`, `name`, `slug` (unique, url-safe), `timezone`, `positions text[]`, `brand jsonb`, `plan text default 'free'`, `created_at` | `positions` replaces the hard-coded list in `src/types.ts`; Francie's gets today's 7. `plan` is just a field for now. |
| `memberships` | `org_id`, `user_id`, `role ('admin'\|'employee')`, PK (`org_id`,`user_id`) | Replaces `profiles.role`. One login can belong to several orgs (a manager who works two spots). |

`org_id not null` added to: `employees`, `shifts`, `shift_offers`, `push_subscriptions` (and `published_weeks` later). Uniqueness that is currently global becomes per-org (`employees.email` unique per org, not globally).

Kept: `profiles` (name/email only), all existing offer/claim/actor/realtime behaviour.

## 2. Security (RLS)

- One helper `my_org_ids()` (`select org_id from memberships where user_id = auth.uid()`) and `is_admin(org_id)`.
- Every policy becomes `org_id in (select my_org_ids())` + the existing per-row rule. `claim_offer`, `bind_push_subscription`, `stamp_offer_actor`, `enforce_invited_signup` get an org dimension.
- The current "first signup becomes admin" rule goes away; see onboarding.
- Verification: a scripted RLS test (two orgs, two users) run against the DB before merging — a user in org A must get zero rows from org B on every table.

## 3. Onboarding

- **New restaurant**: `/new` page → name + slug → RPC `create_organization()` creates the org, makes the caller admin, and creates their employee row (fixes the "owner has no staff row" oddity). Behind a switch (`allow_self_serve_orgs`) so at first *you* create orgs; open it later if wanted.
- **Staff**: unchanged flow — manager adds email on Team, invite link now carries `?org=<slug>`; `enforce_invited_signup` checks the email against that org's employees. A user who already has a login and is invited to a second org just gets a new membership.
- **Org switcher**: only shown when a login has ≥2 memberships (dropdown in the app bar); current org persisted per device. Everything in `DataContext` is loaded for the current org.

## 4. Branding (per org, via `organizations.brand`)

Phase A (cheap, in the first PR): `display_name`, `accent_color`, `logo_url` (Supabase Storage bucket `org-assets`, admin-upload from a new Settings page). Applied to the app bar, the login page when reached via `/o/<slug>/login`, and email templates (`{{ .Data.org_name }}` — one template with a variable, not per-org templates).
Phase B (later, on demand): per-org PWA name/icon and theme colour. Needs a manifest served per org (`/o/<slug>/manifest.webmanifest` via a Netlify function) and a home-screen re-add for existing installs; skip until someone asks.
Not planned: custom domains per restaurant (possible later via Netlify domain aliases → slug lookup).

## 5. Notifications

Recipient lookup in the `notify` function is already employee-based; add `org_id` to the payload/filters so managers of org A never get org B events. Push subscriptions belong to a user, so a multi-org user gets pushes from all their orgs (title prefixed with the org name when they have >1).

## 6. Migration of Francie's

Single migration, run once:
1. create `organizations` row "Francie's" (slug `francies`, positions = current list);
2. add `org_id` columns, backfill with that id, set `not null`;
3. create `memberships` from `profiles.role` for all 4 existing logins;
4. swap policies/functions; drop `profiles.role` last.
Rollback = the reverse script, tested on a Supabase branch first. No data loss risk to existing shifts/offers.

## 7. Demo mode

`mockStore` gets the same shape (one demo org) so demo keeps working with no Supabase.

## 8. Sequencing (separate PRs, each independently shippable)

| PR | content | size |
|---|---|---|
| 1 | Schema + RLS + memberships + migration of Francie's + org-scoped `DataContext`/stores; no visible UI change besides positions coming from the org. | ~1 session |
| 2 | Onboarding: `create_organization`, `/new` (switch-gated), org-aware invites, org switcher, Settings page with Phase-A branding. | ~1 session |
| 3 | Notify function org scoping + org-prefixed titles; per-org email template variable. | half session |
| 4 (optional) | Phase-B branding (per-org manifest/icon), custom domains. | half session each |

PR 1 should land before publish-week / time-off (each of those adds a table that would otherwise need retrofitting).

## 9. Product decisions needed from you

1. One login in multiple restaurants — yes (recommended) or one org per login?
2. Self-serve "create a restaurant", or you create orgs by hand for now (recommended to start by hand)?
3. Positions per restaurant, editable by their managers (recommended), or one global list?
4. Branding scope for the first pass: name + colour + logo (recommended), or also PWA icon/name now?
5. Any billing intent? Changes nothing structurally, but I'd add a `plan`/`status` on the org from day one (included above).

## 10. Risks

- RLS regressions are the only real risk; mitigated by the scripted two-org test and running PR 1 against a Supabase branch before production.
- Existing installs/subscriptions are unaffected (same URL, same VAPID keys).
- `POSITIONS` is referenced widely in the UI; moving it to org data is the largest mechanical change in PR 1.
