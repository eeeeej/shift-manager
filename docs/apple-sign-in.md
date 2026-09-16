# Sign in with Apple

Configured 2026-09-15. No app code is Apple-specific: the "Continue with Apple"
button calls `signInWithOAuth({ provider: 'apple' })` like Google does.

## Apple Developer

| Object | Value |
| --- | --- |
| App ID | `com.shiftmgr.app` (Sign in with Apple capability) |
| Services ID — the OAuth `client_id` | `com.shiftmgr.web` |
| Domain | `wqvvmmcteevirvcqjevb.supabase.co` |
| Return URL | `https://wqvvmmcteevirvcqjevb.supabase.co/auth/v1/callback` |
| Team ID | `4A747QPL8C` |
| Key ID | `9AQB889649` |

The `.p8` signing key is stored as the Devin secret `APPLE_SIGNIN_PRIVATE_KEY`
(Apple only lets you download it once).

## Supabase

Set through the Management API:

```
PATCH https://api.supabase.com/v1/projects/wqvvmmcteevirvcqjevb/config/auth
{ "external_apple_enabled": true,
  "external_apple_client_id": "com.shiftmgr.web",
  "external_apple_secret": "<JWT>" }
```

The secret is an ES256 JWT signed with the `.p8`: header `{"kid": KEY_ID}`,
claims `{"iss": TEAM_ID, "iat": now, "exp": now + 180d,
"aud": "https://appleid.apple.com", "sub": "com.shiftmgr.web"}`.

## The secret expires

Apple caps the JWT at six months. The current one expires **2027-03-15**; it
must be re-signed and PATCHed before then or Apple login silently breaks.

## Quick check

```sh
curl -sS -o /dev/null -D- \
  "https://wqvvmmcteevirvcqjevb.supabase.co/auth/v1/authorize?provider=apple&redirect_to=https://shift-mgr.netlify.app"
```

Expect a 302 to `appleid.apple.com/auth/authorize?client_id=com.shiftmgr.web`.
Fetching that URL with a browser user-agent should return Apple's sign-in page
without an `"errorMessage"`; "Invalid client id or web redirect url" means the
Services ID's domain/return URL don't match.

## Hide My Email

Signups are invite-only by employee email. Apple's "Hide My Email" returns a
`@privaterelay.appleid.com` address that won't match Team, so the signup is
rejected. Staff must choose "Share My Email" the first time.
