# Supabase Email Templates (copy-paste)

Where to paste: **Supabase Dashboard → Authentication → Emails → Message Templates**.

The app verifies a **numeric code** (`verifyOtp`), so both templates MUST contain
`{{ .Token }}`. The confirmation link is optional to keep — users can click it or
type the code. Save after pasting.

---

## 1. Confirm signup

This is the email a new user gets after signing up ("Check your inbox" screen).

**Subject**

```
Confirm your signup
```

**Body (simplest — code only, no link)**

```
Your confirmation code is: {{ .Token }}
```

---

## 2. Magic Link / OTP

This is the email for "Log in with a one-time code" (`signInWithOtp`). The login
screen only has a code input, so the code line is what makes it work.

**Subject**

```
Your sign-in link
```

**Body (simplest — code only, no link)**

```
Your sign-in code is: {{ .Token }}
```

---

## Notes

- `{{ .Token }}` is replaced by the server with the 6- or 8-digit one-time code.
  The app accepts both lengths. That single line is all you need — the email will
  contain the code, not a link.
- The default templates also support a clickable `{{ .ConfirmationURL }}` link.
  You do **not** need to add it.
- Which template fires:
  - "Confirm signup" → new account creation
  - "Magic Link" → passwordless sign-in (one-time code)
  - "Reset password" → "Forgot password?" (this one is link-based — leave it as
    the default link so the click lands on `https://subhalt.xyz/login`)