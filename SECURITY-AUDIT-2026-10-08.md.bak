
## 6. Fix status — Applied (2026-10-08)

The following fixes were implemented in code after this audit. All existing tests remain passing (578 passed) and the production build is green. Remaining deployment steps are listed explicitly below.

| Finding | Fixed in code? | Location(s) | What was changed |
|---|---|---|---|
| CR-1 | Fix only (SQL) | `supabase/migrations/013_restrict_profile_updates.sql` | RLS migration restricting self-update of privileged columns already exists; **not yet applied to the live Supabase DB.** This remains exploitable in production until run. |
| CR-2 | Yes | `lib/auth/access.ts` | Switched to `resolveServerPlanTier()` reading the server-authoritative `profiles` row (with expiry handling and admin → premium). All enforcement paths now use it. |
| CR-3 | Yes | `package.json`, lockfile | Bumped `next` to 16.4.0, `eslint-config-next` to 16.4.0, `vitest` to ^5.0.3, `@types/node` to ^24. `npm audit fix` applied for `brace-expansion`, `js-yaml`, `source-map-js`. Remaining: `braces`/`micromatch`/`fast-glob` (dev-only ESLint tooling). There is no patched release; the team accepted this dev-only high-severity advisory. |
| H-1 | Partially | `next.config.ts`, `app/layout.tsx`, `lib/config/adsense.ts` | CSP no longer includes `'unsafe-eval'` in production builds. AdSense script host is only whitelisted and the loader script is only emitted when an ad slot is configured (`ADSENSE_ENABLED`). The `httpOnly:false` Supabase session cookie is intentionally retained by design (browser client must read the session); this trade-off is documented in `lib/supabase/cookie-options.ts`. No stored-XSS sinks were introduced. |
| H-2 | Yes | `lib/services/gmail-token-crypto.ts`, `lib/services/gmail-service.ts` | Added AES-256-GCM token encryption with key derived from `GMAIL_TOKEN_ENCRYPTION_KEY` (SHA-256). Blob format `v1:<iv>:<tag>:<ct>`. Only `refresh_token`, `scope`, `token_type` are persisted; `access_token` is never stored. Legacy plaintext rows are transparently re-encrypted on read. Decryption fails closed if the key is removed after encryption. |
| M-1 | Yes | `lib/rate-limit.ts` | `getClientIp()` now prefers `x-real-ip`, otherwise uses the **rightmost** value from `x-forwarded-for` (prevents client spoofing of the first entry). |
| M-2 | Yes | `app/auth/callback/route.ts`, `lib/paystack/index.ts` | Redirect origins no longer trust forwarded headers. Production always uses the configured canonical origin via `getSiteUrl()`. Development/test uses the request's own origin. `resolvePublicOrigin()` updated accordingly. |
| M-3 | Yes | `lib/services/gmail-service.ts`, `app/api/gmail/auth/route.ts`, `app/api/gmail/oauth/callback/route.ts` | OAuth state is a nonce bound to the authenticated user id (`createGmailState` → `<hex>.<userId>`). Callback verifies the state matches the cookie and that the embedded user id equals the session's `auth.uid()`. |
| M-4 | Yes | `app/api/ai/chat/route.ts`, `app/api/gmail/scan/route.ts`, `app/api/gmail/disconnect/route.ts`, `app/api/admin/providers/route.ts`, `app/api/admin/users/[id]/plan/route.ts` | Removed all raw error messages from client responses. Specific details remain logged server-side. |
| L-1 | Yes | `lib/paystack/index.ts`, `app/api/paystack/initialize/route.ts`, `lib/paystack/__tests__/index.test.ts` | Transaction references no longer embed any user id fragment. They are fully random (`SUBHALT-<ts>-<12-byte hex>`). Tests updated to match. |
| L-2 | Yes | `lib/services/account-delete-code.ts`, `lib/email/*`, `app/api/profile/delete-account/send-code/route.ts`, `app/api/profile/delete-account/route.ts`, `components/settings/delete-account-modal.tsx` | OAuth-only accounts (no `email` identity) receive a stateless 6-digit HMAC code via email to confirm deletion. Password accounts continue to use password re-auth. The modal auto-detects identity and shows the appropriate flow. Requires `ACCOUNT_DELETE_SIGNING_KEY` (falls back to `SUPABASE_WEBHOOK_SECRET`/`CRON_SECRET`). |
| L-3 | Yes | `public/sw.js` | Notification click handler rejects off-origin `data.url` values and falls back to same-origin `/`. |

### Deployment checklist

- [ ] **Apply migration 013** to the live Supabase project (`supabase/migrations/013_restrict_profile_updates.sql`). Verify privileged column updates are blocked for non-admin users while `update_user_name` and admin grants still work.
- [ ] **Set new environment variables in production:**
  - `GMAIL_TOKEN_ENCRYPTION_KEY` (minimum 16 chars). Rotating the key after encryption is not supported by the current scheme; treat as a long-lived secret. Deploy after setting.
  - `ACCOUNT_DELETE_SIGNING_KEY` (or ensure `SUPABASE_WEBHOOK_SECRET`/`CRON_SECRET` exist) to enable the OAuth-only deletion code flow.
  - `NEXT_PUBLIC_ADSENSE_AD_SLOT` (and keep `NEXT_PUBLIC_ADSENSE_CLIENT` if overridden) if AdSense units are to be rendered; when unset, the loader is not emitted and CSP keeps the host unlisted.
- [ ] **Deploy** the code changes (Next 16.4.0 + fixes).
- [ ] **Verify** Gmail connections: existing plaintext rows will be re-encrypted on first access via `getAuthedGmailClient`. New connects write encrypted blobs. Disconnect/reconnect is safe.
- [ ] **Smoke test** the delete-account modal for both identity types and the Gmail connect flow (state binding).
- [ ] **Monitor** logs for `[gmail-token-crypto]` warnings in non-prod only; in prod they should not appear once the key is set.
