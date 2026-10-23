# Google OAuth: why Gmail blocks verification, and how to fix it

This guide explains the warning on **Google Auth Platform → Data access** and the exact steps to unblock Google sign-in while keeping Gmail Connect as a future feature.

---

## The short version

Google sign-in only needs three basic permissions:

- `openid`
- `email`
- `profile`

None of those are sensitive.

Gmail Connect asks for one more permission:

```
https://www.googleapis.com/auth/gmail.readonly
```

Google classifies that as a **restricted scope** because it lets an app read a person's entire mailbox. Restricted scopes require a long review and, because SubHalt stores the data on a server, an annual security assessment (CASA).

**The feature flag does not remove the scope from Google.** The flag only hides the button inside SubHalt. Google still sees `gmail.readonly` declared on the Google Cloud project, so it still requires restricted-scope verification.

You therefore have two clean choices:

1. **Remove Gmail from the sign-in project and publish.** Gmail Connect stops working for now. Fastest.
2. **Move Gmail to its own Google Cloud project, keep that project in Testing, and publish the sign-in project.** Gmail keeps working for admins/test users; the public sign-in consent screen has no restricted scope.

Do not leave the Gmail scope on the public sign-in project and hope the flag hides it from Google. Google reviews the project configuration, not the runtime UI.

---

## Is this compulsory? Will it cause problems?

**It is compulsory only if you want public Google sign-in.** Google reviews the scopes declared on the project. If the sign-in project declares `gmail.readonly`, Google will not let you publish it for everyone without restricted-scope verification and CASA. A feature flag does not change that.

**It is not compulsory if you stay in Testing.** You can leave everything as-is, but only the Google accounts listed as test users can sign in. That is not a public launch.

**A second project is not mandatory.** It is the cleanest way to keep admin Gmail testing while publishing sign-in. The alternatives are:

- Remove the Gmail scope and turn Gmail off until later.
- Keep one project and submit Gmail for restricted-scope verification.

**What can go wrong:**

- Existing Gmail connections break when you change the OAuth client; disconnect and reconnect.
- A Gmail project in Testing shows the unverified-app warning and may expire refresh tokens after 7 days, so admins reconnect weekly.
- Two projects means two consent screens and two branding setups.
- If you publish with the Gmail scope still declared, Google may block publishing or show an unverified warning. That is the real launch risk.

**Bottom line:** If Gmail is a future feature, remove it from the sign-in project now. If you still need to test it, use a separate Gmail-only project. Do not leave the restricted scope on the public sign-in project.

---

## The three things Google uses

It helps to separate these:

| Thing | What it is | Where it lives |
| --- | --- | --- |
| **Google Cloud project** | A container for APIs, branding, scopes, and OAuth clients | Google Cloud Console |
| **OAuth client** | The app's credentials: a Client ID and Client Secret | Inside one Google Cloud project |
| **Consent screen / Google Auth Platform** | What users see when Google asks for permission | Belongs to the project, not the client |

A project owns the consent screen. If a project declares `gmail.readonly`, Google applies restricted-scope rules to that project, even if only one admin account ever uses it.

SubHalt uses two OAuth clients:

- **Sign-in client** — configured in Supabase → Authentication → Providers → Google.
- **Gmail client** — configured in Vercel as `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI`.

They may currently be the same client. If they are, that is the root of the problem: moving Gmail to a separate project is what lets sign-in publish without Gmail verification.

---

## Option A — defer Gmail completely (fastest)

Use this if you do not need to test Gmail Connect right now.

### 1. Find the sign-in project

1. Open Supabase → **Authentication → Providers → Google**.
2. Copy the **Client ID** shown there.
3. Open Google Cloud Console → **APIs & Services → Credentials**.
4. Find that Client ID under **OAuth 2.0 Client IDs**. The project that contains it is your **sign-in project**.

This is the project you must clean up and publish.

### 2. Remove the Gmail scope from the sign-in project

1. In the sign-in project, open **Google Auth Platform → Data access**.
2. Under **Your restricted scopes**, remove:
   ```
   https://www.googleapis.com/auth/gmail.readonly
   ```
3. Save.
4. Confirm the only remaining scopes are the basic sign-in scopes (`openid`, `email`, `profile` / `userinfo.email`, `userinfo.profile`).

If the console does not show a Remove control, use the old **OAuth consent screen → Scopes** page and remove it there.

### 3. Disconnect any existing Gmail connections first

If an admin account already connected Gmail, disconnect it before removing the scope:

- SubHalt → **Settings → Integrations → Gmail → Disconnect**.

The app will no longer be allowed to request that permission after you remove it.

### 4. Turn the Gmail feature off in SubHalt

In Vercel → Project → Settings → Environment Variables, set:

```
NEXT_PUBLIC_GMAIL_CONNECT_ENABLED=false
```

Redeploy. This hides the Gmail Connect UI and makes the Gmail API routes return "not available" because the server checks the same flag.

`NEXT_PUBLIC_*` values are baked in at build time, so changing the variable is not enough — a new deployment is required.

### 5. Publish the sign-in project

1. Google Auth Platform → **Audience**.
2. Complete any remaining branding fields.
3. Click **Publish app**.
4. If Google asks for brand verification, complete it. With no restricted scopes, you do **not** need CASA or a restricted-scope review.

### 6. Check the public legal URLs

Google must be able to open these **without signing in**:

- Privacy policy: `https://www.subhalt.xyz/privacy`
- Terms of service: `https://www.subhalt.xyz/terms`

Do **not** use `https://www.subhalt.xyz/settings/privacy`. That page is inside the app and redirects signed-out visitors to `/login`, which Google reports as "insufficient content."

### Result of Option A

- Google sign-in can be published.
- Public users never see a Gmail permission.
- Gmail Connect is unavailable, including for admins, until you set up Option B.
- The code does not need to change. The feature flag and existing API checks handle it.

---

## Option B — keep Gmail testing for admins only

Use this if you want to keep testing Gmail Connect while publishing normal Google sign-in.

The idea is simple: **two Google Cloud projects.**

- **Sign-in project** — no Gmail scope. Published for everyone.
- **Gmail project** — has `gmail.readonly`. Stays in **Testing**, so only the Google accounts you list can use it.

### 1. Create the Gmail project

1. Google Cloud Console → project picker → **New project**.
2. Name it something clear, for example `SubHalt Gmail Internal`.
3. Create it and switch to it.

### 2. Enable the Gmail API

1. **APIs & Services → Library**.
2. Search for **Gmail API**.
3. Click **Enable**.

### 3. Configure the Gmail consent screen

In **Google Auth Platform** (or **OAuth consent screen**):

- **Branding** — app name, support email, logo. Use the same SubHalt branding so the screen is recognizable.
- **Authorized domain** — `subhalt.xyz`. Verify the domain in Search Console if Google asks.
- **Audience** — choose **External**, then keep the publishing status at **Testing**.
- **Test users** — add the Google accounts that will test Gmail (the admin accounts). Testing allows a limited number of users; that is fine here.
- **Data access** — add:
  ```
  https://www.googleapis.com/auth/gmail.readonly
  ```

Because this project stays in Testing, Google shows the "unverified app" warning only to those test users. They can continue through **Advanced → Continue**. You do not need to submit this project for verification yet.

### 4. Create the Gmail OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name it `SubHalt Gmail`.
4. Under **Authorized redirect URIs**, add exactly:
   ```
   https://www.subhalt.xyz/api/gmail/oauth/callback
   http://localhost:3000/api/gmail/oauth/callback
   ```
5. Create it and copy the **Client ID** and **Client Secret**.

The redirect URI must match character-for-character. A trailing slash or a different host produces `redirect_uri_mismatch`.

### 5. Point SubHalt's Gmail integration at the new client

In Vercel → Environment Variables, update:

```
GOOGLE_CLIENT_ID=<new Gmail client id>
GOOGLE_CLIENT_SECRET=<new Gmail client secret>
GOOGLE_REDIRECT_URI=https://www.subhalt.xyz/api/gmail/oauth/callback
```

Redeploy.

For local Gmail testing, update `.env.local` too:

```
GOOGLE_CLIENT_ID=<new Gmail client id>
GOOGLE_CLIENT_SECRET=<new Gmail client secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/oauth/callback
```

Restart the dev server after changing `.env.local`.

### 6. Remove the Gmail scope from the sign-in project

Repeat **Option A, steps 1 and 2** on the **sign-in** project:

- Find the project containing the Supabase Client ID.
- Remove `gmail.readonly` from Data access.
- Leave only the basic sign-in scopes.

Do **not** remove the sign-in client itself. Supabase needs it.

### 7. Publish the sign-in project

Google Auth Platform → **Audience → Publish app**. With no restricted scope, this does not trigger the Gmail review/CASA process.

### 8. Reconnect existing Gmail accounts

Changing `GOOGLE_CLIENT_ID` means old Gmail refresh tokens belong to the old client. They may stop working.

1. Before changing the env vars, disconnect Gmail in SubHalt for each admin account.
2. After the new client is live, reconnect Gmail.
3. If a connection still shows as connected but scanning fails, disconnect and reconnect.

### Result of Option B

- Public Google sign-in works with no Gmail permission and no restricted-scope review.
- Gmail Connect still works for the admin/test accounts.
- Because the Gmail project stays in Testing, Google may expire its refresh tokens after 7 days. Expect to reconnect Gmail during testing.
- The Gmail project stays in Testing. When you are ready to release Gmail to all users, submit **that** project for restricted-scope verification and CASA.

---

## What if you eventually want Gmail for everyone?

You will need to complete Google's restricted-scope process on the Gmail project:

1. **Brand verification** first.
2. **Public privacy policy and terms** on the same domain:
   - `https://www.subhalt.xyz/privacy`
   - `https://www.subhalt.xyz/terms`
3. **Domain verification** in Google Search Console for `subhalt.xyz`.
4. **Scope justification** explaining why `gmail.readonly` is necessary and why a narrower scope will not work. Google will push back if it thinks email forwarding already solves the problem, so be precise about what automatic discovery adds.
5. **Demo video** showing the complete end-to-end flow:
   - The user starts signed in to SubHalt.
   - The user chooses to connect Gmail.
   - The full Google consent screen appears, including the Gmail scope.
   - The user grants access.
   - SubHalt scans and shows a discovered subscription/receipt.
6. **CASA security assessment** from a Google-approved assessor, because Gmail data is stored/processed on your server.
7. **Annual recertification** after approval.

Expect weeks, not days, and budget for the assessment. Do not submit until the video, privacy policy, and justification are final; a rejection costs time.

The current privacy policy already includes a Gmail limited-use disclosure, so that part is covered.

---

## Why keeping the same project does not work

Some people try this:

- Keep both sign-in and Gmail on one Google Cloud project.
- Hide Gmail behind a feature flag.
- Publish the app.

Google still sees the project's declared scopes. Publishing with `gmail.readonly` on the project triggers restricted-scope verification, regardless of which button is visible in the app. If you do not publish, only test users can sign in. That is why the clean fix is to separate the projects or remove the scope.

---

## Checklist

### If deferring Gmail (Option A)

- [ ] Sign-in project identified by matching the Supabase Client ID
- [ ] `gmail.readonly` removed from the sign-in project's Data access
- [ ] Existing Gmail connections disconnected
- [ ] `NEXT_PUBLIC_GMAIL_CONNECT_ENABLED=false` set in Vercel and redeployed
- [ ] Sign-in project published
- [ ] `/privacy` and `/terms` load signed out
- [ ] Google verification no longer asks for restricted-scope review

### If keeping admin Gmail testing (Option B)

- [ ] New Gmail-only Google Cloud project created
- [ ] Gmail API enabled in that project
- [ ] Gmail consent screen in Testing with admin accounts as test users
- [ ] `gmail.readonly` added to the Gmail project
- [ ] Gmail OAuth client created with the two exact redirect URIs
- [ ] Vercel `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` updated and redeployed
- [ ] `.env.local` updated for local testing
- [ ] `gmail.readonly` removed from the sign-in project
- [ ] Sign-in project published
- [ ] Existing Gmail connections disconnected and reconnected
- [ ] Public sign-in consent screen shows only basic scopes

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Sign-in still asks for Gmail | You edited the Gmail project, or Supabase still points at the shared client | Match the Supabase Client ID to the project and remove the scope there |
| `invalid_scope` when connecting Gmail | The Gmail scope was removed from the project the Gmail client belongs to | Add it back to the Gmail-only project, or use Option B |
| `redirect_uri_mismatch` | The redirect URI in Google does not exactly match `GOOGLE_REDIRECT_URI` | Paste the exact URL; check scheme, host, path, and trailing slash |
| Gmail "Access blocked" during testing | The Google account is not a test user | Add it under Audience → Test users |
| Privacy page "insufficient content" | You submitted `/settings/privacy`, which requires login | Submit `https://www.subhalt.xyz/privacy` |
| Gmail scanning fails after moving clients | Old refresh tokens belong to the old OAuth client | Disconnect and reconnect Gmail |
| Google says the app is unverified | The Gmail project is in Testing | Expected for admin-only testing; only test users can continue |

---

## Files in the app that matter

No code change is required for either option, but these are the relevant pieces:

- `lib/services/gmail-service.ts` — defines `GMAIL_READONLY_SCOPE` and builds the Gmail consent URL.
- `lib/env.ts` — reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- `lib/config/feature-flags.ts` — defines the admin-only Gmail flag.
- `app/api/gmail/*` — server routes that enforce the flag and use the Gmail client.
- `lib/supabase/middleware.ts` — keeps `/privacy` and `/terms` public; `/settings/privacy` remains protected.

The public legal pages are the only URLs Google should crawl for verification.
