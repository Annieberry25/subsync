# Google Search Console — what to do, and what to expect

Written 2026-10-19, after the canonical-host fix and the sitemap trim.
Everything in "Step 0" was verified live against production.

---

## What was wrong (one paragraph, so the steps make sense)

The site served only on `https://www.subhalt.xyz`, while the apex
`https://subhalt.xyz` answered every request with a 308 redirect to www. But
the code emitted the **apex** as canonical everywhere: in the `<link
rel="canonical">` tag, in every one of the sitemap's 17 URLs, and in the
robots.txt sitemap line. So Google was repeatedly told "the real page is at
`https://subhalt.xyz/...`", followed that URL, and was bounced to www by a
redirect — a self-contradicting signal, reported as **"Failed: Redirect
error"**. On top of that, 12 of those 17 sitemap URLs were behind the login
wall (`307 → /login` for anyone not signed in, Googlebot included).

Both causes are now fixed in production/code:

| Fix | Where | State |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL = https://www.subhalt.xyz` | Vercel env (Production) | deployed |
| Sitemap limited to the public pages (commit `c5e402e`; now also lists `/privacy` and `/terms`) | `app/sitemap.ts` | pushed — **needs a deploy** if your Vercel project does not auto-deploy `landing-wip` |

---

## Step 0 — Confirm the fix is live (2 minutes, do this first)

Open these three URLs in a normal browser. If any of them is wrong, fix the
deploy before touching Search Console.

1. `https://www.subhalt.xyz/sitemap.xml`
   - Expect exactly **7 `<url>` entries** once the legal-page deploy is live
     (5 before it).
   - Every entry must start with `https://www.subhalt.xyz`.
   - Expected pages: `/`, `/features`, `/how-it-works`, `/about`, `/help`,
     `/privacy`, `/terms`.
   - If you still see 17 entries or `https://subhalt.xyz`, redeploy commit
     `c5e402e` and re-check.
2. `https://www.subhalt.xyz/robots.txt`
   - Expect `Sitemap: https://www.subhalt.xyz/sitemap.xml` (with `www`).
3. `https://www.subhalt.xyz/about` → View Source → search for `canonical`
   - Expect `<link rel="canonical" href="https://www.subhalt.xyz/about"/>`.

All three were confirmed correct on 2026-10-19.

---

## Step 1 — Add a Domain property (recommended)

A **Domain** property covers the apex, www, and every subdomain in one place.
With it, Search Console treats the apex → www 308 as an ordinary redirect
instead of a contradiction, and you never have to guess which host to inspect.

1. Search Console → property selector (top left) → **Add property**.
2. Choose **Domain** (not "URL prefix").
3. Enter `subhalt.xyz` (no `https://`, no `www`, no trailing slash) → **Continue**.
4. Google shows a DNS TXT record of the form
   `google-site-verification=XXXXXXXXXXXXXXXX`.
5. Add that TXT record where your DNS lives:
   - **DNS at Vercel:** Project → **Settings → Domains** → your domain →
     **DNS Records** → add record: Type `TXT`, Name `@`, Value = the string
     Google gave you (the whole `google-site-verification=...`).
   - **DNS at a registrar (Namecheap, Cloudflare, etc.):** add the same TXT
     record there, name `@` (or the bare domain), value as given.
6. Back in Search Console → **Verify**.
   - Usually verifies in minutes. DNS caching can take a few hours; Google
     allows up to 72 hours. If it fails, wait and retry — do not re-add the
     record under a different name.

**Only if you cannot touch DNS:** add a **URL-prefix** property for
`https://www.subhalt.xyz/` instead and verify it with an HTML tag. That means
adding `verification: { google: '...' }` to the metadata in `app/layout.tsx`,
redeploying, then verifying. More moving parts; prefer the Domain property.

---

## Step 2 — Submit the sitemap

1. Left nav → **Indexing → Sitemaps**.
2. In "Add a new sitemap", enter the **full URL**:
   `https://www.subhalt.xyz/sitemap.xml`
   (For a Domain property, full URLs are required. If you made a www
   URL-prefix property instead, `sitemap.xml` alone is enough.)
3. **Submit**.

Expected within minutes: status **Success**, **7 discovered URLs** (5 until the
legal-page deploy is live).

If it says **Couldn't fetch**: open the URL in a browser first. If it loads,
retry in a few hours. If it still fails, check that the URL is the www host
exactly and that robots.txt does not block it (it currently doesn't).

---

## Step 3 — Ask Google to index the home page

1. Paste `https://www.subhalt.xyz/` into the search bar at the top of Search
   Console → Enter.
2. If it says "URL is not on Google", click **Request indexing** — once.
3. Optional sanity check: **Test live URL** → **View tested page** → **HTML**
   tab → confirm the canonical is `https://www.subhalt.xyz/` and the fetch
   shows 200, not a redirect.

Requesting the home page is enough. The sitemap covers the other pages;
re-requesting them individually does not speed anything up meaningfully.

---

## What to expect, and when

| Time after submitting | Where to look | Normal result |
| --- | --- | --- |
| Minutes | Sitemaps | Success, 7 discovered (5 before the legal-page deploy) |
| 1–3 days | Page indexing | "Discovered – currently not indexed" (normal for a new/small site) |
| 3 days – 2 weeks | Page indexing | "Page is indexed", or "Crawled – currently not indexed" |
| 1–3 weeks | URL Inspection → Google-selected canonical | `https://www.subhalt.xyz/` |

Indexing is not instant and not guaranteed by requesting it. A young site with
few inbound links can sit at "Crawled – currently not indexed" for weeks; that
is an authority signal, not a technical error, and the redirect error cannot
recur once the canonical host is consistent.

---

## Statuses you may see, and what each means

| Status | Meaning | Action |
| --- | --- | --- |
| **Page with redirect** | You inspected an apex (`subhalt.xyz`) URL. Expected — the apex is a 308. | Inspect the `www` URL instead |
| **Discovered – currently not indexed** | Google knows the URL, hasn't crawled it yet | Wait; nothing to fix |
| **Crawled – currently not indexed** | Crawled, but Google chose not to index (thin/duplicate/low authority) | Improve content and links; not a technical error |
| **Excluded by 'noindex'** | A meta noindex is present | Check page source (none was added by us) |
| **Duplicate, Google chose different canonical** | Canonical disagreement from the old apex setup | Should disappear after the next crawl; re-check in 1–2 weeks |
| **Couldn't fetch** (sitemap) | Host mismatch or transient fetch failure | Confirm the URL 200s anonymously; resubmit |
| **Alternate page with proper canonical tag** | A non-canonical variant of an indexed page | Fine, no action |

---

## Do / Don't

**Do**
- Use the Domain property (or the www URL-prefix property) as the source of truth.
- Submit only `https://www.subhalt.xyz/...` URLs.
- Request indexing once for the home page.
- Re-check Sitemaps and Page indexing after a week.

**Don't**
- Don't submit or inspect `https://subhalt.xyz/...` — it only ever redirects.
- Don't submit `/plans`, `/settings`, `/profile`, `/export`, `/history*`,
  `/renewals`, `/inbox`, `/subscriptions` — all answer `307 → /login` and were
  deliberately removed from the sitemap.
- Don't resubmit the sitemap or click "Request indexing" daily; it does not
  accelerate crawling and adds noise.
- Don't create a second sitemap listing the same URLs.

---

## About the property you may have already added

If you previously added a URL-prefix property for `https://subhalt.xyz/`, it
will **keep reporting redirect errors forever** — every URL in that property
redirects, by definition. After the Domain property is verified, either leave
it (harmless) or remove it. Inspect URLs only in the Domain property (or the
www URL-prefix one).

---

## Known content gap (not a technical error)

Nothing publicly indexable states what SubHalt costs. `/plans` is an in-app
checkout screen behind the session guard, so it cannot rank — correctly, it was
removed from the sitemap. If pricing search traffic matters, the options are a
public `/pricing` page or a pricing section on the landing page. That is a
content decision; when it exists, add its route to `app/sitemap.ts`.

---

## Final checklist

- [ ] `https://www.subhalt.xyz/sitemap.xml` → 5 entries, all www
- [ ] `https://www.subhalt.xyz/robots.txt` → sitemap line uses www
- [ ] Domain property `subhalt.xyz` verified
- [ ] Sitemap submitted → Success, 7 discovered (5 before the legal-page deploy)
- [ ] Home page Test live URL → 200, canonical = `https://www.subhalt.xyz/`
- [ ] Request indexing submitted once for the home page
- [ ] One week later: Page indexing checked; "Redirect error" gone
