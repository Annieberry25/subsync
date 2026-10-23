# Google sign-in branding: show "Continue to SubHalt"

The Google account screen is rendered by Google, not by SubHalt. It shows the
name configured on the OAuth client's consent screen. Supabase projects use
Supabase's shared Google credentials by default, so Google falls back to the
callback host — `jmqsefdevgznqkheifjp.supabase.co` — instead of an app name.

This guide replaces those shared credentials with a SubHalt-owned Google OAuth
client, so the screen reads **Continue to SubHalt** and shows the SubHalt logo.

No application code changes are needed. The Client ID and Secret live in the
Supabase dashboard, not in this repo.

## Values used in this guide

| Setting | Value |
| --- | --- |
| Production site | `https://www.subhalt.xyz` |
| Supabase project ref | `jmqsefdevgznqkheifjp` |
| Supabase OAuth callback | `https://jmqsefdevgznqkheifjp.supabase.co/auth/v1/callback` |
| App name | `SubHalt` |
| Privacy policy | `https://www.subhalt.xyz/privacy` |
| Terms of service | `https://www.subhalt.xyz/terms` |
| Local dev callback | `http://localhost:3000/auth/callback` |

The Supabase callback is **not** `/auth/callback` on subhalt.xyz. Google talks
to Supabase first; Supabase then redirects the browser to
`https://www.subhalt.xyz/auth/callback` (handled by
`app/auth/callback/route.ts`).

## Before you start: is this Google Cloud project shared?

Consent-screen branding is configured **per Google Cloud project**, not per
OAuth client. If the project currently showing the previous app name is still
used by that app, renaming its branding changes the name its users see too.

- Old app is retired, or this project exists only for SubHalt → continue below.
- Old app is still live → create a **new Google Cloud project** for SubHalt and
  do every step in that project instead.

Renaming the OAuth app does not change the Client ID, Client Secret, redirect
URIs, or existing Google sign-ins.

## 1. Create or select the Google Cloud project

1. Open <https://console.cloud.google.com/>.
2. Use the project picker at the top and select the SubHalt project, or create a
   new one (for example `SubHalt Auth`).
3. You do not need to enable any Google APIs for basic sign-in.

## 2. Configure the OAuth consent screen / branding

Google renamed this area to **Google Auth Platform**. Depending on the console
version you see **APIs & Services → OAuth consent screen** or **Google Auth
Platform** in the left menu. Both lead to the same settings.

### Branding

1. Open **Branding** (older UI: **OAuth consent screen**).
2. Fill in:
   - **App name**: `SubHalt`
   - **User support email**: a mailbox you monitor
   - **App logo**: optional, but this is what makes the screen look like SubHalt
   - **Privacy policy URL**: `https://www.subhalt.xyz/privacy`
   - **Terms of service URL**: `https://www.subhalt.xyz/terms`
   - **Developer contact information**: your email
3. **Authorized domains**: add `subhalt.xyz` only.
   - Do **not** add `supabase.co`. That domain cannot be verified by you and it
     is not required — the Supabase URL is an authorized *redirect URI* on the
     OAuth client (step 3), not an authorized branding domain.
   - If Google asks you to verify `subhalt.xyz`, verify it in Google Search
     Console with the same Google account.
4. Save.

### Audience / publishing status

1. Open **Audience** (older UI: **OAuth consent screen → Publishing status**).
2. Choose **External** user type unless you use Google Workspace internally.
3. While testing, add the Google accounts you sign in with under **Test users**.
4. When you are ready for real users, click **Publish app**.
   - Basic scopes (`openid`, `email`, `profile`) do not require full Google
     verification, so publishing is normally immediate.
   - If the app was previously verified, changing the app name can trigger a
     brand re-review; sign-in keeps working in the meantime.

### Data access / scopes

Supabase requests `openid`, `email`, and `profile`. These are non-sensitive.
If the console asks you to add scopes, add those three; do not add Gmail or
other sensitive scopes here. Gmail receipt scanning is a separate feature with
its own OAuth client and scopes (`SETUP-GMAIL-CONNECTION.md`).

## 3. Create the OAuth client

1. Open **Clients** (older UI: **Credentials**).
2. **Create client** → Application type **Web application**.
3. Name: `SubHalt Web`.
4. **Authorized JavaScript origins** (optional for the Supabase flow):
   - `https://subhalt.xyz`
   - `https://www.subhalt.xyz`
   - `http://localhost:3000`
5. **Authorized redirect URIs** — add exactly:
   - `https://jmqsefdevgznqkheifjp.supabase.co/auth/v1/callback`

   This is the only URI Google needs. Do not add `https://subhalt.xyz/auth/callback`
   here; Supabase is the OAuth client, not the Next.js app.
6. Create the client and copy the **Client ID** and **Client Secret**. The
   secret is shown once — store it somewhere safe until you paste it into
   Supabase.

`redirect_uri_mismatch` means this URI is not an exact character-for-character
match (scheme, host, path, no trailing slash).

## 4. Put the credentials into Supabase

1. Open the Supabase dashboard for project `jmqsefdevgznqkheifjp`.
2. Go to **Authentication → Sign In / Providers → Google**.
3. Enable Google if it is not already enabled.
4. Paste the **Client ID** and **Client Secret** from step 3.
   - Leaving these fields blank makes Supabase use its shared credentials
     again (and the Supabase hostname reappears on Google's screen).
5. Copy the **Callback URL** Supabase shows on this page and confirm it matches
   the redirect URI from step 3 exactly.
6. Save.

Supabase applies these immediately; no redeploy or rebuild is needed.

## 5. Confirm Supabase URL configuration

Authentication → **URL Configuration**:

- **Site URL**: `https://www.subhalt.xyz`
- **Redirect URLs**:
  - `https://www.subhalt.xyz/auth/callback`
  - `https://subhalt.xyz/auth/callback`
  - `http://localhost:3000/auth/callback`
  - Add any Vercel preview pattern you actually use.

If `redirectTo` is not allow-listed, Supabase silently drops it and sends the
browser to the Site URL, so the callback route never runs. This is separate
from the Google branding fix.

## 6. Test

1. Open `https://www.subhalt.xyz/login` in a private window.
2. Sign out of Google first, or use the account chooser, to avoid a cached
   consent screen.
3. Click **Continue with Google**.
4. Expected:
   - The address bar briefly visits `jmqsefdevgznqkheifjp.supabase.co` while
     Supabase starts the flow — this is normal.
   - Google then shows **Choose an account to continue to SubHalt** (with the
     logo if uploaded).
   - After choosing an account, the browser returns to `subhalt.xyz/auth/callback`
     and lands signed in.
5. Repeat on `http://localhost:3000/login`. The same Google client works
   locally because Google always redirects to Supabase, and Supabase forwards to
   whichever app origin started the flow.

## Troubleshooting

| What you see | Cause | Fix |
| --- | --- | --- |
| Google says **continue to jmqse...supabase.co** | Supabase is still using shared Google credentials, or the branding app name was not saved | Recheck steps 2 and 4 |
| `redirect_uri_mismatch` | Redirect URI on the Google client differs from the Supabase callback | Paste the exact callback URL from Supabase → Google → Clients |
| **Access blocked: app not configured for your account** | Consent screen is in Testing and the Google account is not a test user | Add the account under Audience → Test users, or publish the app |
| Browser stops at `jmqse...supabase.co` with an error/JSON | Google provider disabled, or Client ID/Secret invalid | Enable the provider and re-paste the credentials |
| Sign-in returns to the wrong host | Supabase URL Configuration is missing the origin | Add `/auth/callback` for that origin under Redirect URLs |
| Google shows "unverified app" | App not verified by Google | Expected for a new external app; basic scopes can stay unverified, or submit for brand verification if it must disappear |

## Notes

- Renaming the app is safe: existing users, sessions, Client IDs, and redirect
  URIs are unaffected. Branding is display-only.
- To roll back, clear the Client ID/Secret in Supabase and save. Google sign-in
  continues through the shared Supabase credentials, and the Supabase hostname
  returns to the consent screen.
- `NEXT_PUBLIC_SITE_URL` in `.env.example` must stay `https://www.subhalt.xyz`
  to match Supabase's Site URL; it is not part of the Google client config.

## Checklist

- [ ] Google Cloud project is dedicated to SubHalt (not shared with a live app)
- [ ] Branding app name is `SubHalt`
- [ ] Privacy and Terms URLs point at `https://www.subhalt.xyz/privacy` and `/terms`
- [ ] Authorized domain is `subhalt.xyz` (verified if Google asks)
- [ ] Audience is published, or test accounts are listed while testing
- [ ] OAuth client redirect URI is exactly `https://jmqsefdevgznqkheifjp.supabase.co/auth/v1/callback`
- [ ] Client ID and Secret are saved in Supabase → Authentication → Providers → Google
- [ ] Supabase Site URL is `https://www.subhalt.xyz`; Redirect URLs include www, apex, and localhost
- [ ] Private-window sign-in shows "Continue to SubHalt" and returns to `/auth/callback`

## If Google blocks publishing: the Gmail scope

If Data access says the app needs sensitive/restricted scope verification,
the cause is the Gmail receipt scanner, not Google sign-in. See
[`GOOGLE-OAUTH-DATA-ACCESS.md`](./GOOGLE-OAUTH-DATA-ACCESS.md) for the two
fixes: remove Gmail from the sign-in project, or move Gmail to a separate
Gmail-only Google Cloud project so the sign-in project can publish without
restricted-scope verification.
