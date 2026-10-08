# Trouble report: "Sign in with OTP" does not work

**Date:** 2026-10-08
**Affected flow:** Log in → "Log in with a one-time code" (and the same email path on sign-up)
**Project:** Supabase `https://jmqsefdevgznqkheifjp.supabase.co` · site `https://subhalt.xyz`

---

## How the flow is wired in this codebase

The browser calls Supabase Auth directly (GoTrue). **The app does not send the
OTP email itself — Supabase does.**

| Step | Where |
| ---- | ----- |
| 1. User taps "Log in with a one-time code" | `components/auth/login-flow.tsx:206` → `supabase.auth.signInWithOtp({ ..., shouldCreateUser: false })` |
| 2. Supabase GoTrue checks the email, writes a token, and emails the 6‑digit code | Supabase Auth (server side, not this repo) |
| 3. User types the code → app verifies it | `components/auth/login-flow.tsx:238` → `supabase.auth.verifyOtp({ ..., type: 'email' })` |
| Same path on sign-up | `components/auth/signup-flow.tsx:109` (OTP) and `:139` (`verifyOtp` `type: 'signup'`) |

So anything that stops Step 2 (login) or Step 3 breaks the whole "one-time code"
experience.

---

## What I tested (live probe against the project, anon key)

I reproduced the exact `POST {SUPABASE_URL}/auth/v1/otp` call the app makes, with
both flag settings, and got **hard, server-side answers**:

1. Unknown address + `create_user: false` (what the login code sends):

   ```
   STATUS 422  in 871ms
   BODY {"code":422,"error_code":"otp_disabled","msg":"Signups not allowed for otp"}
   ```

2. Unknown address + `create_user: true` (proves the send path either way):

   ```
   STATUS 500  in 1425ms
   BODY {"code":500,"error_code":"unexpected_failure",
         "msg":"Error sending confirmation email","error_id":"..."}
   ```

### Root cause (confirmed): Supabase Auth cannot send email

`"Error sending confirmation email"` is GoTrue failing before it can deliver the
code. The email provider configured under **Supabase → Authentication → Emails**
(SMTP or Resend) is rejecting / erroring on send. This is a **Supabase-dashboard /
email-provider configuration issue, not a bug in this repo's code.** Because the
mailer errors server-side, the user never receives a code (and, depending on the
failure, the UI may only show "Check your inbox" or a generic error).

### Contributing cause (confirmed, by design): unknown addresses are rejected

The login flow deliberately sets `shouldCreateUser: false`
(`login-flow.tsx:222`) so an unregistered address **must** fail instead of being
silently signed up. That produces the `otp_disabled` 422 that looks like "OTP is
broken" when testing on an address that was never created as an account.

---

## Fix — your side (Supabase dashboard + Resend), blocking

Do these in order; steps 1–2 are almost certainly the current problem:

1. **Wire a working Resend provider into Supabase Auth**
   - Supabase Dashboard → **Authentication → Emails → Providers → Resend**.
   - Enable it and paste the `RESEND_API_KEY` (already in your `.env.local`).
   - Set **From email** to an address on `mail.subhalt.xyz`, e.g.
     `SubHalt <noreply@mail.subhalt.xyz>`, and a From name.
2. **Verify `mail.subhalt.xyz` in Resend** (this is the usual blocker)
   - Resend dashboard → Domains → add `mail.subhalt.xyz` → add the DNS records
     Resend shows (SPF/DKIM `TXT`, and `_amazonses.…` `TXT`) at your DNS
     provider, set **Type: Sending**, wait for "Verified".
   - An unverified/undelegated sender domain makes Resend reject sends, which is
     exactly the `500 Error sending confirmation email` above.
3. **Check the Magic Link message template**
   - Supabase → Authentication → **Emails → Message Templates → Magic Link**.
   - It must contain the code token `{{ .Token }}` (the 6‑digit code the input
     asks for). If a previous edit removed it, users get an email but no code.
     Keep the subject/`{{ .SiteURL }}`/`{{ .Email }}` and the confirmation link.
4. **Redirect URLs** (only needed for the clickable-link half of the email)
   - Authentication → URL Configuration → Redirect URLs: ensure
     `http://localhost:3000/**` and `https://subhalt.xyz/**` … both present,
     else the link inside the email lands off-app.
5. **Testing notes**
   - For OTP sign‑in on production, the address must already be an account
     (sign up first, or use the account you created).
   - After step 1–2, re-run the probe below — a working send returns `200`.

### Re-check after you fix your side

```powershell
# probe (anon key is fine) — expect BOTH calls to return 200
$u  = "<NEXT_PUBLIC_SUPABASE_URL>"
$k  = "<NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY>"
curl.exe -s -X POST "$u/auth/v1/otp" -H "apikey: $k" -H "Authorization: Bearer $k" -H "Content-Type: application/json" -d '{"email":"<your-real-email>","create_user":false}'
```

---

## Fix — code side (optional, I can implement)

None of this repo's code is required to make OTP work once Supabase can send
email. Two small improvements would make the failure *visible* instead of vague:

1. `components/auth/login-flow.tsx` — map known GoTrue errors to clear copy:
   - `otp_disabled` → "There's no SubHalt account for this email — check the
     address or sign up first."
   - `unexpected_failure` / "Error sending confirmation email" → "Could not send
     the code (the server's email sender is not configured)."
2. Same mapping in `components/auth/signup-flow.tsx` for its OTP step.

This turns the silent "doesn't work" into an actionable message for any user
while you fix the provider settings.

---

## Bottom line

- OTP sign‑in code is correct; the failure is **email delivery on the Supabase
  side** (`500 Error sending confirmation email`).
- Unregistered addresses additionally fail by design (`422 otp_disabled`) —
  expected, but worth surfacing clearly.
- Fix = enable **Resend** under Supabase Auth emails + verify `mail.subhalt.xyz`
  + keep `{{ .Token }}` in the Magic Link template. Then OTP just works; the only
  code change on offer is friendlier error messages.