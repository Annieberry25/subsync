# SubHalt — Marketing Plan (the one file)

_How this file works: this is the master marketing file. Every future marketing
note, strategy change, idea, or report gets appended into this file unless you
("the user") tell me to create a separate sub-file. Newest entries go at the
bottom under `## Log`. Related-but-separate files, only by user request._

- Product: SubHalt (subhalt.xyz) — subscription & recurring-bill tracker.
  Free tier is the product; Plus $3.99/30 days one-off, NGN via Paystack.
- Markets: Nigeria primary (Tunde-first), US awareness secondary (Sarah-first).
- Positioning (locked, from `docs/MARKETING-FEATURE-AUDIT.md`): _Most apps tell
  you what you spent. SubHalt stops the surprise charge._ No-bank-login, warns
  BEFORE the charge, never cancels with the provider.
- Companion docs: `docs/MARKETING-FEATURE-AUDIT.md` (claims + sources),
  `launch-video/` (the existing ad film), `docs/FEATURES.md` (product audit).
- **Companion file: `MARKETING-PLAN-CONTENT.md` — the copy file.** The voice
  rules, the finished written pieces, the written column ("The Debit Alert")
  and the open items live there. This file holds strategy, channels, metrics
  and the decision log. Wording changes go in the content file.

---

## 1. The verdict on "post the ads video first"

It is not "post an ad" — it is that a video cannot be the **first move** of a
go-to-market. Three reasons, each sourced:

1. **Cold paid traffic buys attention without trust.** Finance products live on
   trust; 2026 industry analysis (Forbes, Aug 2026 — "Why Paid Acquisition
   Doesn't Work For Consumer Apps") documents that consumer apps winning today
   abandoned paid-first acquisition: no proof, no reviews, no retargeting pool,
   no organic CVR baseline means the algorithm optimizes for cheap installs
   that churn. Coconote (bootstrapped to $1M ARR in 4 months, $6.7M ARR and
   exit) deliberately went all-in on organic content instead of ads.
2. **Paid ads will not fix a conversion problem; they will hide it.** Guidance
   for bootstrapped brands (MHI Growth Engine, Feb 2026) is explicit: do not
   scale paid before organic/warm conversion is proven (≥2%) and there are real
   organic conversions (~50) behind it. Below that, ads only burn budget on
   broken fundamentals. SubHalt currently has none of those numbers measured.
3. **A one-video launch is a spike, not a system.** Growth in this category
   comes from content volume + intent channels + community, run as an engine
   (see Phases). Distribution precedent we can measure against: an organic
   creator video hitting ~1M views produced ~1,800 installs (~0.18%) and $3k
   revenue for the productivity app "Locked" (Stormy case study, Apr 2026).
   Useful expectation-setting: virality alone converts ~1–2 installs per 1,000
   views. That is a fine channel — but it needs *many* posts and faces, and it
   is not "one ad film."

**Therefore: the launch film is not the opening move — it's ammunition for
Phases 2–5.** It's a good asset; it was just aimed at the wrong phase.

## 2. The better approach — "the Trust Engine"

Sequenced, compounding phases. Each phase feeds the next. Paid ads are the
LAST phase (gasoline on proven fires), not the first.

### Phase 0 — Baseline (Week 0–1, non-negotiable prerequisites)
Nothing else counts unless we can measure it.
- `utm` discipline on every link (utm_medium/source/campaign), per channel.
- Conversion events on subhalt.xyz: signup, first subscription added, Plus
  purchase. Get Startup Analytics up (this may already exist — verify).
- Record the current organic conversion rate of the landing page. This number
  gates Phase 5.
- App Store presence: we are a PWA — the closest "store" pages are Google Play
  listing absence; promote install-to-home-screen flows.

### Phase 1 — Own the intent (Weeks 1–6): free tool + programmatic SEO
Why: Rocket Money's biggest quiet moat is its "How to Cancel [Service]
Subscription" pages (thousands, e.g. rocketmoney.com/learn/personal-finance/
resume-now-cancel). People at the moment of cancelling are EXACTLY our user.
SubHalt already owns the raw material:
- **34-provider curated catalog with official cancellation/payment URLs**
  (`lib/constants/provider-catalog.ts`) → build `/cancel/[provider]` pages:
  step-by-step "how to cancel Netflix / Showmax / PureVPN…", plus the price,
  cycle traps, and a free reminder offer ("cancel with the provider, and pin
  the reminder here"). Slow start, but pages compound for years.
- 27 biller integrations + 89 aliases → "How to pay / stop paying a DISCO"
  pages (no competitor anywhere has this content).
- **Free tool flywheel** (HubSpot Website Grader model, Apr 2026 guides):
  a public, no-signup **"Subscription Audit"** calculator — enter your subs
  (or just monthly guesses), get your annualized "dead subscription bill" and
  a shareable result URL. Tool converts at 10–25% (Toolradar benchmark), gets
  used in blog pages, communities, and future TikTok hooks ("I calculated how
  much my forgotten subscriptions cost this year — 312,000").
  - Nigeria angle: the calculator must speak ₦ and the subpriced.com data
    (ChatGPT Plus ₦31,500 > US price; Netflix ₦6,500) for local-share moments.
- Notes from myself-adjacent builders (Indie Hackers, Jul 2026, Calculator4U):
  SEO takes months; domain trust matters; AI Overviews are eating simple
  calculator traffic — so tool pages must embed *content + tool*, not tool
  alone. This is a 6–12th month payoff, expect near-zero at first. That's fine
  — it runs parallel to faster channels below.

### Phase 2 — The organic short-form engine (Weeks 2–13)
This is the Coconote playbook (RevenueCat Sub Club, Mar 2026): not ads posters,
but *many small creators with good content quality*; not influencer fame,
content quality; avoid agency-repped accounts (the "alpha" is gone there);
target unknown-but-talented creators with 5–10K followers.
- Persona-first, not brand-handle-first: brand accounts underperform creator
  personas in recommendation feeds (Maja, Jun 2026). Build one founder persona
  + 2–3 persona accounts joining the "personal finance" vertical:
  - Nigeria: X (Nigerian fintech Twitter is the main place), TikTok NG
    personal-finance/salary-humor niche, WhatsApp Channels for followers.
  - US: TikTok + Reels + Shorts, faceless formats are fine (screen recording
    of the app, voiceover B-roll, text overlay) — platforms reward completion
    rate, not faces (Faceless.my, Sep 2026).
- Cadence & structure (SocialRevver, Feb 2026): daily (or at least 5×/week)
  posts, ONE consistent niche per account — algorithm must learn who we are.
  Mix: 50% discovery (the "2.6 dead subscriptions" hooks, the forgotten-trial
  story), 30% value (how to cancel X in 40 seconds; DISCO bills explained),
  20% conversion (savings counter, testimonial, offer). 60–90s > 15s now
  (AutoFaceless, May 2026); optimize for saves/shares (2026 ranking signals).
- Learning loop: 4-week batches, then clone the top 3 performers with variant
  hooks (TokPortal, Mar 2026). Cross-post the same file to TikTok/Reels/Shorts/
  Facebook Reels (Facebook Reels is the quiet winner for reach).
- Creator partnerships: find 3–5 Nigeria micro-creators (5–10K followers,
  fintech-adjacent, comment quality > follow count) — first deals are cash OR
  equity OR flat one-offs; US micro-UGC later.
- Repurpose plan: every video becomes Reel + Short + X embed + blog embed.

### Phase 3 — Communities, earned media, trust (Weeks 4–13)
- **Nigeria earned model = PiggyVest's playbook (verified researched):**
  - Annual **"SubHalt Subscription Report"**: survey (this year; later data
    from the app) exposing subscription waste, trial traps, what Nigerians
    pay above US prices for. PiggyVest's Savings Report is now a national
    PR machine + annual Roundtable + BusinessDay/Nairametrics coverage —
    an owned data event that makes the brand the category's voice of truth.
    Launch first edition in Q1 2027 (needs ~6–8 weeks runway).
  - Zikoko / TechCabal / Nairametrics / BusinessDay earn-outs: pitch data
    pieces ("Half of ChatGPT subscribers don't use it — and Nigerians pay
    MORE than Americans for it") rather than app plugs.
  - WhatsApp + Telegram groups where Nigerians discuss money — the partner
    channels. PiggyVest grew through community events (OpenHouse) — plan
    campus meetups/partner appearances later, don't start there.
  - Trust note from Smartsave founder (TechCabal, Jan 2026): "The tech sits
    quietly in the background, earning trust slowly." Finance-onboarding in
    Nigeria converts on *proof of people + proof of no risk* (free, no card,
    no bank login). We already own all three; say them in every touchpoint.
- **US communities:** Reddit r/personalfinance, r/frugal, r/mintuit,
  r/BookRecommendations-type participation = genuine helpful replies
  (personal-audit calculator link only in bio/profile), NOT self-promo
  posts (new accounts get shadow-banned; build account age first).
- **Launch platforms:** Product Hunt + Hacker News show-your-demo once —
  useful for backlinks and first-1,000 users, not a growth channel beyond.

### Phase 4 — In-app word-of-mouth loops (starting Week 6, product work)
The product already has the raw virality assets; wire them to distribution:
- **Savings counter screenshot** (dashboard total-saved) — one-tap share
  story with the number + wordmark. "This app proved I stopped wasting
  ₦48,600 this quarter."
- **Personalized annual report** (Kuda's "My Year on Kuda" model): a 30-second
  shareable recap: what you paid, what you cancelled, what you saved — post
  this every December, and drive app attribution to it.
- Referral: give a month of Plus for each signup that completes tracking.
  Free tier is permanent, so a Plus month is a real gift without churn pain.
- The reminder emails/push ARE marketing copy engines — they face the user
  at the single highest-emotion moment (charge warning). Write them like a
  savior, not a sysadmin. (Copy in `docs/MARKETING-FEATURE-AUDIT.md` §6.)

### Phase 5 — Paid, only after proof (Week 12+, gate-gated)
Gate: organic CVR ≥ 2%, 50+ organic signups, refreshable winning creative.
Then: retargeting pools first, spark ads on winning organic posts, Google
intent for /cancel/ pages, NGN channels where measured CAC < ₦2,500 per user
(competitive CAC for Nigerian fintech acquisition is notoriously high and
FX-volatile — Nigeria Fintech Marketing Outlook 2024/2025). Ads budget the
marketing budget last, not first.

## 3. What the ad film is for (existing asset, correctly used)
- Repo: `launch-video/` (30s master + 35s "Two Point Six" cut for
  TikTok/Reels/Shorts; the product-capture slots are currently mock UI — swap
  real recordings in before any high-authority or paid placement).
- Uses, now correctly sequenced:
  1. **Pinned end-card:** the account's featured video + link-in-bio hook for
     every Phase 2/3 touchpoint — placements where one video must carry
     everything on its own.
  2. **Watch-instead-of-read:** embedded on landing/tool pages.
  3. **Phase 5 spark-ad source:** winning organic creative becomes the paid
     ad after the gate passes.
- Remaining blocker on it: mock product UI must be replaced by real captures
  (`launch-video/scripts/capture-real-recordings.mjs`) before paid or high-
  authority placement use. For organic low-follower posting, acceptable only if
  hooked on the "2.6 dead subscriptions" story, not product credibility.

## 4. Channel economics + expectations (benchmarks, sourced)
| Phase / channel            | Cost          | Time to first payoff | Expected payoff | Source |
|----------------------------|---------------|----------------------|-----------------|--------|
| Organic short-form         | time          | 2–6 weeks            | ~0.18% view→install (1M views ≈ 1.8k installs) once the engine matures | Stormy / Locked case study |
| Creator micro-partnerships | $ per post    | 3–5 weeks            | same ~1.8k installs/1M-views baseline; require ≥1% to continue | Coconote / RevenueCat |
| Programmatic /cancel/ SEO  | mostly eng time | 6–12 months, compounds | long-tail; Rocket Money runs the same "how to cancel X" pages at scale | Rocket Money live pages |
| Free tool flywheel         | eng time      | 1–3 months (SEO-coated) | 10–25% tool conversion; capture at result, not upfront | Toolradar / Dupple |
| Communities & earned media | time          | days-weeks           | 10–1,000+ signups per earned hit; Reddit answers are slow accumulators | PiggyVest methodology; TechCabal / Nairametrics |
| In-app loop (savings-share + year report) | eng time | quarters | compounding; hard to attribute without share-URL tracking | Kuda / PiggyVest precedent |
| Paid ads                   | media $ + creative burn | instant | unknown until organic CVR ≥ 2% is proven — assume poor | MHI / Forbes 2026 |

## 5. The 90-day plan (what happens next, concretely)
**Week 1 (now–Oct 31):**
- [ ] Baseline: analytics + conversion events verified; users tracked by utm.
- [ ] Decide persona account identities (founder persona + 2 silents) and
      pick ONE niche vertical each (finance-tips NG / sub-watcher US).
- [ ] Spec the free tool: no-signup Subscription Audit calculator with a
      shareable result URL (~2–3 eng days).
- [ ] Draft /cancel/[provider] template + build first 10 most-searched
      providers (data exists in provider-catalog.ts).
- [ ] Hold: no ads. The film waits.
**Weeks 2–4 (Nov):**
- [ ] Ship the tool + 10 /cancel pages. Product Hunt + HN "show" posts once.
- [ ] Start posting: founder persona 5×/week; extra persona accounts only once
      posting capacity is proven. Draft one Zikoko-style earned-media pitch.
      WhatsApp beat: join, watch, share tool results into 3 finance
      groups/week (no app plugs yet — tool results only).
- [ ] First Reddit account opened and nurtured (30 days, no links).
- [ ] In-app: add share story for dashboard savings number.
**Weeks 5–8 (Dec):**
- [ ] First organic winners identified → spin 3 variant hooks each.
- [ ] 5 Nigeria micro-creators shortlisted (5–10K followers, no agency).
- [ ] Survey design for Subscription Report 2027 (piggyvest model).
**Weeks 9–13 (Jan–Feb 2027):**
- [ ] Creator partnerships live (2–3 first).
- [ ] Report fielded; press outreach plan drafted.
- [ ] AD GATE REVIEW: CVR ≥ 2%? organic ≥ 50 signups? IF yes, to retargeting.
      If no, phase-5 stays closed and we compound Phase 1–4.

## 6. Metrics & kill criteria (reviewed monthly)
- Core: weekly post count (engine health), profile-visit rate (8–12% of views
  target), watch-through ≥60%, follower conversion 15–25% of profile visits
  (SocialRevver benchmarks), signup→first-sub rate, organic signups by source,
  CVR, /cancel/ page impressions→signups, tool uses→signups.
- Kill criteria: creators after 2 posts/each under 0.5% conversion rate at
  10k+ views → replace, not repeat. /cancel/ pages: if 6 months in page #
  impressions to signups < 0.5% → reduce to top 5 pages, stop publishing more
  (long-tail pages still run; not worth labor). Tool: if tool 30-day usage
  < 100 uses/month with no signups → redesign the offer, not the tool.
- Budget norm: NO ad spend in first 90 days under any pressure. If "must
  spend" happens anyway, cap is the Phase-5 gate — not organic.

## 7. What NOT to do (each with its reason — product guardrails are in
`docs/MARKETING-FEATURE-AUDIT.md` §7; those claims rules apply to marketing too)
- **Never imply we cancel for you** ("cancels your subscriptions", "stops the
  charge"). The safe line is "stops the surprise charge" — SubHalt warns,
  routes and tracks; the user cancels with the provider.
- **No AI-availability promises** ("the AI is always available"). Assistant
  needs a Groq key; there's a deterministic fallback, but advertise it
  unconditionally.
- **No invented aggregate savings**. The dashboard savings counter is real
  per-user data; don't extrapolate it into products-level totals ("users saved
  ₦X million") until the data genuinely aggregates. Individual screenshots
  with permission are fine; extrapolated totals are not.
- Rocket Money comparison is allowed as positioning (their $7–14/mo plus
  35–60% cut of negotiated savings, vs our $3.99 one-off) — cite the source,
  never present our numbers as promises.
- No post-spam (20 posts in a day), no engagement bait, no follow/unfollow
  bots — 2026 algorithms downrate these and accounts get torched.
- No discount-led acquisition: the price model is a one-off 30 days, and
  discounting a brand that is selling honesty is self-harm.

## 8. Research sources (curated, checked this session)
- Forbes, "Why Paid Acquisition Doesn't Work For Consumer Apps, And What Does"
  (Aug 2026) — why paid-first fails for consumer apps; what works instead.
- RevenueCat Sub Club, "How Coconote hit $1M ARR in 4 months with no paid ads"
  (Mar 2026) — the creator content-engine playbook + onboarding lesson.
- MHI Growth Engine, Bootstrapped-vs-Funded paid ads (Feb 2026) — 50-conversion
  gate + CAC-when-to-scale rules.
- Stormy, "Scaling App Installs with Organic Short-Form Content" (Apr 2026) —
  Locked case: 1M views ≈ 1,800 installs ≈ $3k; creator-fit pillars.
- Maja, TikTok Organic Growth for Apps (Jun 2026) — persona > brand handle;
  daily cadence; Facebook Reels discovery; 4-week learning loop.
- SocialRevver TikTok growth guide (Feb 2026) — benchmarks (60% watch,
  8–12% profile-visit, 15–25% profile→follow).
- AutoFaceless social algorithm statistics 2026 (May 2026) — saves>likes,
  60–90s wins, IG reach decline, 3.7% TikTok engagement rate.
- Faceless.my guide (Sep 2026) — completion-rate formats, no-face strategy,
  one content format for first 10 videos.
- TokPortal startup TikTok guide (Mar 2026) — per-post meritocracy, 3-5/wk
  batching, cross-posting, account health discipline.
- Dupple, Free Tool Marketing Strategy (Apr 2026, upd. Sep) + Toolradar
  calculator lead-magnet guide (Apr 2026) — tool conversion 10–25%, 10-minute
  rule, email capture at result, shareable URL.
- HubSpot blog, Free SaaS mini-tools as lead magnets (Jan 2025) — free-tool
  fitting examples (Website Grader, beehiiv LTV calc, Wiz QR gen).
- Indie Hackers Calculator4U post (Jul 2026) — what SEO for a new-domain
  tool actually feels like (slow, no shortcuts, distribution > build).
- Rocket Money programmatic pages (live check) — "How to Cancel X" pattern.
- Nigeria Fintech Marketing Outlook 2024 (via Fintech News Africa) — paid
  ads dominate today; organic channels expected to win under FX pressure;
  payments/lending have the worst CAC.
- TechCabal fintech surveys (Jan 2025 + 2026 pieces) + Smartsave/Eniola Taiwo
  trust lesson; MTN/Moniepoint/OPay context → Nigerians discover fintech via
  **X + word-of-mouth**, must convert on trust, not on ads.
- PiggyVest Savings Report (2023–2025) + Finance Roundtable + OpenHouse +
  Zikoko Naira Life conference (BusinessDay Mar/Sep 2026) — the Nigerian
  consumer-fintech trust machine: annual data event + community events.
- BusinessDay, "Kuda's My Year on Kuda personalized spending report"
  (early-2025 write up) — personalized year-in-review as a trust+share asset.
- TechCabal, "Owo by Mono launches / 57 million Nigerians on WhatsApp"
  (Jun 2025) — WhatsApp as scale infrastructure, not a marketing gimmick.
- Launch-video README/BRIEF (local) — the ad film context.

## 9. Persona decision + cold-start mechanics (zero followers)

_Appended 2026-10-21, evening. Answers two open questions: founder vs team
accounts, and how to get traffic with zero followers. Researched same session._

### 9.1 Founder vs team members vs brand account

**Decision: the founder is the first and primary account. Team-member accounts
wait. Brand handle maintained but not grown cold.**

Why (sourced):
- Founder-led content converts 3–7× higher than corporate brand content,
  costs ~60% less than agency content, and 82% of consumers trust companies
  more when leadership is visibly active on social (Jarvis Su evidence-based
  report, Jan 2026; Averi founder-led guide). Edelman: 83% trust individual
  experts over branded corporate accounts.
- On TikTok/IG the algorithm distributes people, not handles: coherent persona
  beats brand account (Maja, Phase 2 sources). Corporate handles have lost
  60–66% of organic reach since 2024 on LinkedIn — the same trajectory applies
  platform-wide: people > logos in 2026 (Komet, Favoured, Forbes
  trust-economy pieces).
- Nigerian market reality: fintech trust converts on *people* (the fintech NG
  space is personality-driven; Smartsave's "earning trust slowly" lesson). A
  real Nigerian founder saying "I built this because I kept paying for things
  I forgot" beats every anonymous team voice.

How to run it:
- The founder builds in public: the account niche is "the subscription-waste
  beat" — forgotten subs, trial traps, what Nigerians pay above US prices
  for. The app appears occasionally and never apologetically.
- Team members join *later* as separate personas — especially one running a
  US-facing account (different identity for a different market; the founder's
  NG perspective is authentic for NG content, not required for US content).
  Each new persona must hold a consistent face + niche or it dilutes the
  cold start.
- The brand (@subhalt) account: reposts of founder content + product updates
  + support only. Do not attempt to grow it from zero (see §2 Phase 2).

### 9.2 Topic-first, app-second — yes, with one correction

The instinct is right: grow on the topic ("you're paying for 2.6 dead
subscriptions"), introduce the app when attention exists. Correction per the
2026 research: don't hold the app back for 30 posts as a teaser — that
wag-the-reveal reads manufactured and wastes the ratio discipline. Instead
every video *resolves*, and the app appears where it's the honest resolution:
pinned video, profile link, caption/comment CTA on the 20% "conversion"
posts. The ratio stays 50% discovery / 30% value / 20% conversion (§2). What
converts cold audiences is specificity, not suspense about the product.

### 9.3 Zero-follower distribution mechanics (what actually pulls traffic)

The encouraging truth: TikTok is the one major platform where zero followers
is not a structural handicap — a fresh account can reach millions within 24h
if the clip performs (theworlddata 2026 compilation; tikomate). Mechanics
that matter:

1. **The seed-cohort reality.** Every post is tested on a small wave (~200–500
   views from strangers; some 2026 sources claim a shift toward testing with
   followers first — at zero followers that distinction doesn't exist for us).
   What wins the next, bigger wave is ~70%+ completion, saves, shares,
   rewatches in the first hour. So: post when you can be online for the first
   hour, reply to every early comment (comment replies later become their own
   videos).
2. **First-frame specificity does ~80% of cold-start work** for sub-1k
   accounts (TINS HUB, Q1 2026 measurements). Not "POV:" or "story time" —
   those now underperform. Named stakes win: concrete numbers in frame 1
   ("12 subscriptions. ₦31,500 on ChatGPT. I could name three I actually use.")
3. **Formats that work under 1,000 followers:**
   - the specific-number opener (the 2.6 / $26.79 / ₦31,500 stats are ours to
     weaponize);
   - a 9-slide photo-mode carousel announcing the account's 90-day content
     list ("the 9 things this account will cover for 90 days");
   - photo-mode "search-bait" slides whose captions mirror real TikTok Search
     queries verbatim ("how to cancel Netflix subscription", "find
     subscriptions I forgot") — use Creator Search Insights to pick queries
     with real volume;
   - the 24-hour audit bet with the result promised in a pinned comment,
     delivered in the follow-up video;
   - once comments exist: reply-as-video and comment-screenshot-as-first-frame.
4. **The anti-mistakes list** (this is what actually kills new accounts):
   - deleting "failed" videos or switching niche daily — new accounts go
     through a weeks-long calibration phase with slow, uneven distribution;
   - reposting the identical video file cross-platform/cross-account — TikTok
     flags duplicate content and zeroes the views (re-edit: new sound,
     reworked caption/text when cross-posting);
   - stopping at the 0-view week. The claim "low views ≠ bad video, TikTok is
     still learning who to show you to" is consistent 2026 creator consensus;
     consistency and one-niche clarity are the unlock;
   - bulk-scheduling through third-party APIs (native in-app posting reads
     better to the algorithm and is where platform sounds live);
   - warm-up skip: browse/engage in the niche in-app for a few days before
     the first post so the account's interests — and the algorithm's view of
     it — are coherent.
5. **Cadence:** 1/day for the first two weeks minimum (multiple 2026 sources
   call daily the floor for fast growth: consistent daily posters grow 4–6×
   faster than 3–4×/week posters); 3–5×/week is the sustainable floor after.
   US window: EST 7–9am / 12–2pm / 7–10pm; Nigeria: evenings ~7–10pm WAT.
   First-hour presence matters more than the posting minute.
6. **Language:** street-level clarity, sound-off-safe, big on-screen text
   (most viewers are silent); hook bank: bold promise / question slap /
   confession / named stake; write 5 hooks per idea, post the strongest, keep
   variants for re-testing winners.
7. **Honest expectations:** a 90-day founder sprint benchmarks 500–1,000
   followers by day 30, 3,000–5,000 by day 60 (Remery; predicated on multiple
   daily posts + heavy commenting). With once-daily cadence + 30–60 min/day
   of genuine niche commenting, weeks-1–4 in the hundreds is realistic.
   Kill criterion: if by week 3 the best video is under ~400 views with <50%
   average watch-through, the hooks are the problem — take the top 3, rewrite
   their first frames, re-post as variants.

### 9.4 When to introduce the app (sequenced, exact)
- Posts 1–5: pure problem + personal story. Link in bio from day one, but
  don't speak about the app yet.
- From ~day 7: one native demo post — "I built a small tool that found my
  forgotten subscriptions from my email receipts" — framed as founder's own
  itch, zero sell.
- From days 10–14: tool-lead posts ("I audited my own subscriptions; here's
  the annual damage") + reply-with-your-numbers comment farming; the tool's
  shareable result URL (Phase 1) is what the comments convert on.
- Ongoing: 1-in-5 posts is product-bearing; the other four teach / confess /
  quantify freely. The product is inside the punchline, not the pitch.
- Week 3+: /cancel/ pages get mini-content ("how to actually cancel
  [provider] in 4 steps") — each drives page impressions attributed via UTM
  bio links.

### Research added this round
- Jarvis Su, founder-led vs corporate content evidence report (Jan 2026):
  3–7× conversion, 82%/77% exec-trust stats, 60% lower content cost.
- Remery founder-brand sprint (Sep 2025): 90-day 0→10k schedule; founder
  accounts 3–5× pipeline vs company accounts.
- Komet Media founder-led data report (2026): personal 5–8× engagement vs
  company pages; Edelman trust-contraction context.
- Forbes "People Over Products" (Apr 2025); FoundersNews (Sep 2026);
  Favoured (May 2026): founder-led trust-economy rationale.
- Tikomate grow guide: seed-cohort test waves (200–500), hook formulas,
  3–5×/week cadence, per-clip meritocracy.
- theworlddata TikTok algorithm statistics (2026): zero-follower reach is
  algorithmically unique to TikTok.
- Social Champ zero-follower guide (upd. 2026); MultiPost go-viral-from-zero
  play (Jul 2025): hooks, sounds, noise control.
- TINS HUB 50 TikTok ideas (Jun 2026): sub-1k strategies — first-frame
  specificity, photo-mode search bait with Creator Search Insights, pinned
  Part-2 comments, comment-as-thumbnail; Q1 2026 measured decline of
  POV/story-time openers on small accounts.
- SocialScaleHub, TikTok follower-first algorithm note (2026): possible 2026
  shift to follower-seed testing with a ~70% completion floor — treat as a
  possible regime change; the zero-follower play still runs on stranger
  seeds + niche clarity regardless.
- TikTok discover-page creator consensus (2026): first-week low views are
  calibration; native posting; duplicate-content zeroing; don't delete.

## 10. Week-1 post pack (7 posts, ready to shoot)

_Appended 2026-10-21. The "what do I actually post" answer for the zero-follower
cold start. Platform: TikTok native, cross-post (re-edited variants, never
identical files) to Reels + Shorts. Nigeria-first voice. Every stat used is
sourced in section 8 and may only be framed as "the average person"; where a
post says "mine", use the founder's REAL numbers - run the Day 6 audit for real
before posting Day 7. Never fake a number; authenticity is the engine._

### Warm-up (2-3 days before Day 1)
- Create the account. Bio: one line positioning + subhalt.xyz link (the link
  exists from day 1, is never spoken about in week 1).
- Warm the account: 2-3 days of genuine browsing + commenting in the niche (NG
  money/finance TikTok, "moneytok", personal-finance creators). Follow ~20
  in-beat accounts.
- Have ready: the founder's own subscription count, names, monthly total, and
  one forgotten-trial story. If unknown, keep Day 1 average-person framed and
  make Day 6 real.

### Day 1 (Mon) - The audit carousel
- Format: photo-mode carousel, 8-9 slides.
- Frame 1: "I listed every subscription I pay for. I wish I hadn't."
  (Alt: "The average person pays for 2.6 subscriptions they never use. Mine
  was worse.")
- Slides: how many -> monthly total -> annualized total -> "these two I forgot
  existed" -> "this one I last opened 2 months ago" -> "one charges in $, one
  in N - small, different days, easy to miss" -> "I'm auditing my whole stack
  this week" -> follow CTA.
- Caption mirrors a search query: "subscriptions I forgot to cancel".
- Pinned comment: "Tomorrow: why nobody ever catches these."
- Why: first-frame specificity + search bait; a carousel means day 1 needs no
  face on camera.

### Day 2 (Tue) - The confession
- Format: 30-35s talking head (or voiceover over a notes-app screen if you are
  not ready to be on camera - latest start is Day 9).
- Frame 1 text: "12 subscriptions. $219/month. I could name three." (fill with
  real or average-person numbers).
- Beats: 0s the number / 10s why - auto-pay never asks permission again / 20s
  the trial-trap fact (70% have paid because of a forgotten free trial) / 27s
  "I'm auditing mine all week. Follow to see the damage."
- Caption: one line, no other accounts tagged, no CTA beyond follow.
- Why: confession + named stake; establishes a person, not a pitch.

### Day 3 (Wed) - Pure value: the 5-minute inventory method
- Format: screen recording / hands over a notes app, voiceover or text only.
- Content (teach the method the app will later automate - honestly, with no
  tease): 1) list everything that charges you (search your email receipts)
  2) write the real price + cycle 3) normalize to monthly, then x12 4) write
  "last used" next to each 5) mark the two you would cancel today.
- Frame 1: "Do this tonight - 5 minutes. It pays for itself this month."
- Caption keywords: "subscription tracker" / "how to see all my subscriptions".
- Why: a value post that earns saves - saves and shares are the 2026 ranking
  signals - and it is genuinely useful even without our app.

### Day 4 (Thu) - The trial-trap story
- Format: talking head or text-on-footage, 25-40s.
- Frame 1: "70% of people have paid for a subscription because they forgot a
  free trial." (sourced, Self Financial 2026)
- Beats: the mechanic (auto-pay + no warning) -> a real story (N31,500 for
  ChatGPT, above the US price, or the founder's own forgotten trial) -> "the
  fix isn't willpower, it's a warning before the charge."
- Pinned comment: "What's the last trial you forgot? I'll go first: ..." -
  comment farming; the best replies become a weekend video.
- Why: the highest-emotion fact we own, sitting in frame 1.

### Day 5 (Fri) - Search-bait cancellation carousel
- Format: photo-mode carousel, 5 slides; caption mirrors TikTok Search
  queries verbatim: "how to cancel any subscription on your phone".
- Slides: 1) iPhone: Settings > [your name] > Subscriptions > select > Cancel
  2) Android: Play Store > Payments & subscriptions > Cancel 3) billed
  directly: search "[provider] cancel" and use the OFFICIAL page 4) screenshot
  the confirmation - that is your receipt 5) check the date it stops charging
  -> follow CTA.
- Honesty rule: these are the universal steps only. No provider-specific steps
  until the /cancel/ pages exist (week 3+ content).
- Why: captures search intent for free and makes the account the reference for
  beating the charge - exactly what the Phase 1 pages monetize later.

### Day 6 (Sat) - The 24-hour audit bet
- Format: 30s talking head + pinned comment.
- Frame 1: "I have 24 hours to find out exactly how much I waste on
  subscriptions. Day one starts now."
- Beats: the stake -> the method (Day 3's method, now run on yourself) ->
  "result tomorrow."
- Pinned comment: "Result drops tomorrow at 7pm. My guess: about N[X] a year.
  What's yours?" - a promised number manufactures the reply thread.
- Why: the account's first two-part story; stakes and thread both lift
  completion and the seed cohort's first-hour engagement.

### Day 7 (Sun) - The damage reveal (the week's payoff)
- Format: 45s, phone/notes on a table, real list on screen.
- Frame 1: "It's worse than my guess: [real annual number] a year on things I
  don't use."
- Beats: the number -> the two that will never charge me again (action taken:
  cancel after billing, per the method) -> what I am redirecting the money to
  (real and personal) -> "Next week I do this properly. Follow for the
  before/after."
- No app mention. The app enters around day 10, per section 9.4. This video's
  job is to make the surprise charge personal.
- Why: closes the week's story, sets up week 2, and produces the most
  screenshot-able asset the account has.

### Daily protocol (every day, non-negotiable)
1. Post 7-10pm WAT (US window when the audience is US-facing). Be online for
   the first hour. Reply to every comment within 60 minutes; reply-as-video
   when a comment deserves it.
2. Spend 15 minutes genuinely commenting on 3-5 niche creators' posts - real
   answers, no links, no "check my page". This is how a cold account gets
   seeded into the right audience.
3. Cross-post one re-edited variant (different first-frame text or sound) to
   Reels/Shorts the next day. Never upload the identical file twice on TikTok.
4. Log per post: views, average watch-through, saves, shares, comments, and
   the first frame used. This becomes the variant-retest data (section 9.3.7).
5. If a post runs past 5,000 views before the others: pin it, post the Part 2
   the same night, and ride the wave while the seed cohort is warm.

### Week-1 expectations (honest)
- Views: 200-2,000 per post is a normal cold-start band. One outlier is a win;
  zero outliers is also a normal week 1.
- The real goal: every post at >=50% average watch-through with at least 5
  saves/shares. Follower count is the weakest signal this week.
- Followers: 100+ is nice, 500 is great, 30 is survivable. Week 3 is the
  retest-decision point (section 9.3.7), not week 1 - do not pivot in week 1.

## 11. Written content pack (ready-to-post copy, no camera needed)

> **STATUS UPDATE (2026-10-21, later):** this pack was written before the
> founder's voice landed, and it reads generic. It is DEMOTED to "proof
> appendix" material: a stat can sit *inside* a story (see section 12), but
> never as the opening line. The live templates are in section 12 (voice
> rules, scene template, the polished origin story, and the "The Debit Alert"
> series). The carousel and thread structures here are still useful mechanics
> (slide counts, hook timing, thread length) - use them with the section 12
> voice, not the section 11 copy.

_Appended 2026-10-21, after "give me interesting posts, write-ups are fine".
Written content is not the consolation prize for a founder who can't film — for
this category it is the stronger engine: it carries proof, it is cheap to
produce daily, it can be read with sound off, and it converts a small account
faster than a video. Everything below is real copy: replace only the marked
personal numbers with the founder's real ones._

### 11.1 Where written content wins (2026 data, so we don't guess)
- **X is the Nigeria home turf and the written platform.** X leans on the
  follower graph more than TikTok, BUT it surfaces posts from accounts you
  don't follow once they earn fast early engagement - a founder with 500
  followers can reach tens of thousands (okara.ai, Jun 2026). Threads engage
  **2.1x** a single tweet; reach concentrates in the first 4 hours. Median X
  engagement in 2026 is 1.11% platform-wide, but accounts under 10K followers
  post the **highest median of any tier at 2.18%** - we are in the best tier
  by default, so judge us against that, not against big accounts.
- **What X rewards in writing:** hot takes and strong opinions (hedged brand
  speak performs poorly), threads that teach one specific thing, reactive
  commentary, questions and polls (replies are a top ranking signal), and
  behind-the-scenes/personality. Reply culture IS the virality mechanism:
  when people reply in a thread, X shows the original to their followers - so
  every post should end with a question that demands an answer.
- **Carousels are the top written format on Instagram/LinkedIn:** IG carousels
  0.55% engagement vs 0.41% images, 0.52% Reels (Socialinsider 2026);
  LinkedIn document posts 7.00% vs 4.50% plain text (Socialinsider 2026, 1.3M
  posts). Every swipe is an engagement event, DM shares are weighted 3-5x
  likes, and IG re-serves carousels to people who didn't swipe the first time.
- **Carousel craft rules (2026):** 7-10 slides (8-10 highest engagement; under
  4 slides barely beats a single image); hook slide readable in under 2
  seconds; one idea per slide, max 15-20 words; body text 16pt+ (24pt+ for
  LinkedIn PDF); 2 fonts, 2-3 brand colors, left-aligned; saves are the signal
  to optimise for on educational carousels.
- **Long-form write-ups are the compounding asset** (Phase 1): they rank,
  they get quoted, they get link-pasted, and they feed the video scripts. The
  written layer is not separate from the video layer - it is upstream of it.

### 11.2 One write-up, seven assets (the efficiency rule)
Never write a piece once. Every long write-up becomes:
1. X thread (hook + 8-15 posts + a question at the end)
2. X single (the sharpest line from the thread, standing alone)
3. IG/TikTok carousel (7-10 slides, one idea each)
4. LinkedIn document post (PDF) for the US audience
5. Blog/SEO page (the /cancel/ pages + the audit tool page)
6. Two 30-45s video scripts (the thread, then the carousel, read aloud)
7. A pinned comment + an email version for the list
A founder can produce 5 written posts a day this way. That is the whole
content engine.

### 11.3 Written hook library (first lines - reuse, rotate, test)
- "I wrote down every subscription I pay for. [N] of them. I use [M]."
- "70% of people have paid for a subscription because they forgot a free trial."
- "89% of people underestimate what they pay for subscriptions. They guess $86.
  The real number is $219."
- "The worst financial advice on the internet right now: cancel all your
  subscriptions."
- "Your subscription tracker isn't the problem. Your memory is."
- "Nobody warns you before the money leaves. That's the entire bug."
- "Here's a free way to find every subscription you pay for. It takes 5 minutes
  and it costs nothing."
- "ChatGPT costs more in Nigeria than in the US. That's ₦31,500 a month."
- "I cancelled 4 subscriptions this week. One of them I had paid for 3 years."
- "You have a subscription list already. It's in your bank app. You just read it
  wrong."
- "What if a subscription tracker didn't show you a chart, but knocked on your
  door two days before the charge?"
- "Everyone has one of these. The subscription they can't name."

### 11.4 The pack (10 posts, full copy)

**A. X THREAD (12 posts) - the audit. Post this first, day 1.**
> 1/ I wrote down every subscription I pay for. [14] of them. I could name [4]
> I actually use. *(Use your real numbers. Small numbers are fine and better:
> "6. I use 3.")*
> 2/ So I priced them out. [12] bill monthly, [1] bills yearly, [1] bills
> quarterly.
> 3/ Normalised to a month, my subscriptions cost me about [$X].
> 4/ Times 12. That's [$Y] a year. For things I mostly don't open.
> 5/ The part nobody warns you about: 89% of people UNDERESTIMATE what they
> pay for subscriptions. They guess $86. The real number is $219.
> 6/ And it isn't laziness. $19.99 doesn't feel like a bill. Nobody sends you a
> reminder before it leaves.
> 7/ Autopay means the payment stopped asking permission. It just takes it.
> 8/ 70% of people have paid for a subscription because they forgot to cancel a
> free trial. Average cost of that mistake: $34.31.
> 9/ So I cancelled the ones I don't use. [4] of them.
> 10/ That's [$Z] a year I'm not spending on a service I already forgot I had.
> 11/ Now the harder half: I'm re-checking in 30 days to see what I let back
> in. Cancelling is only half of this.
> 12/ If you want the exact list + the 5-minute method I used, it's in my bio.
> What's the one subscription you'd kill today? I'll go first: [yours].

**B. X single - the hot take (post day 2, standalone)**
> Your subscription tracker isn't the problem. Your memory is.
>
> A tracker tells you what you spent. Your bank statement tells you what you
> spent - just later, and worse.
>
> The only version of this problem that actually saves money is a warning
> before the charge.
>
> That's the whole product. Everything else is a dashboard.

**C. X single - the trial fact + question (post day 3)**
> 70% of people have ended up paying for a subscription because they forgot to
> cancel a free trial.
>
> Not because they were careless. Because the trial started 3 weeks ago and
> nothing ever said "hey, you're about to start paying".
>
> What's the last trial you forgot? I'll go first: [your real one].

**D. X poll (day 3 evening, poll posts collect replies)**
> Be honest: which subscription do you pay for and never use?
> Streaming / Gym / An AI tool / The one I can't even name
>
> (Polls drive replies, and replies are how X spreads a post to new people.
> Reply to every single answer with a one-liner. Never a link.)

**E. IG/TikTok carousel - 8 slides (day 4). Slide copy, ready to typeset**
> 1. 5 signs you're paying for things you forgot *(hook, readable in 2s)*
> 2. 1. You couldn't name what charged you in the last 30 days.
> 3. 2. Your monthly spend is a guess. Most people guess $86. The real number
>    is $219.
> 4. 3. You re-subscribed to something you cancelled "last year".
> 5. 4. A free trial you forgot became a monthly charge. That happened to 70%
>    of people.
> 6. 5. You only find out when the money's gone. Never before.
> 7. The 5-minute fix: list them -> normalise to monthly -> times 12 -> mark
>    last used -> cancel the two you'd feel nothing about.
> 8. Do step 1 tonight. It's free and it's the most money you'll save this
>    month. Save this. Follow for more like this.
>
> Caption: "subscription audit for people who think they've got it handled.
> Save it before you forget. #moneytok #personalfinance #subscriptions"

**F. IG/TikTok carousel - the Nigeria version (day 5). Local data, local stakes**
> 1. What ₦4,500 a month really costs you
> 2. Netflix ₦6,500. Spotify ₦1,600. YouTube Premium ₦2,200. (Avg Nigerian
>    subscription spend: ₦4,500/month - StateGlobe 2026)
> 3. ChatGPT Plus: ₦31,500. That's 18% more than Americans pay. Claude +12%.
>    Notion +25%.
> 4. Add one AI tool you "use" to a stack you already forget about.
> 5/5. Times 12. That's the number nobody wants to look at.
> 6. The trap: none of these charge you at once. They charge you on different
>    days, in two currencies, so no single alert ever fires.
> 7. What to do tonight: list every recurring charge, write the real price,
>    times 12, and mark the last time you opened each one.
> 8. Save this. Send it to the friend who says "I don't waste on subscriptions".
>
> *(Attribution rule: when a stat is American, say "in a 2026 survey of 1,272
> Americans" - never present US data as Nigerian data. The audit's copy bank
> has the sources.)*

**G. X single - the local fear post (day 6)**
> Showmax shut down in April.
>
> If you were still paying for it, you were paying for a platform that no
> longer existed. That's not a budgeting failure - that's a subscription with
> no warning system.
>
> Which service are you paying for that you haven't opened this quarter?

**H. LinkedIn document post - US audience (day 7, PDF, 8 slides)**
> Slide 1: The 15-minute subscription audit (a template for people who hate
> spreadsheets)
> Slide 2: Step 1 - one place: your email receipts, your bank statement, your
> card.
> Slide 3: Step 2 - the real price, not the promo price.
> Slide 4: Step 3 - normalise: weekly x52, monthly x1, quarterly /3, yearly /12.
> Slide 5: Step 4 - the only column that matters: last opened.
> Slide 6: Step 5 - annualise, then mark the two you'd cancel without feeling
> anything.
> Slide 7: What the math usually shows: 2.6 unused subscriptions, $26.79 a
> month, about $321 a year.
> Slide 8: The part apps don't do: warn you before the charge. Save this and
> run it tonight.
>
> Caption (text above the PDF, teasing without giving it away):
> "I asked 1,272 people about their unused subscriptions. The average person
> is paying for 2.6 things they never use - about $321 a year.
> That's the number that made me build something. Here's the 5-step audit I
> use to find mine, free, in 15 minutes. Slide 9 is the step most people
> skip. Save the PDF; it's easier than the instructions."
>
> *Upload spec: PDF (not images), 1080x1350 portrait, 8-12 slides, under 60
> words per slide, body 24pt+, and give the file a real title - the filename
> is visible to everyone, so never ship "Untitled-final-v3".*

**I. The receipts post (any day - the trust format)**
> Screenshot of one real charge (redact everything but the merchant + amount).
> Caption: "$19.99. I hadn't opened it in 7 months.
>
> You already have a subscription list - it's your bank app. You're just
> reading it wrong.
>
> Which charge of yours would you not survive if it repeated?"

**J. The founder write-up (the link-in-bio destination, 300 words - first
long-form piece)**
> Title: "I built a subscription tracker that won't cancel anything for you"
> Opening line: "Most subscription apps do one of two things: they show you a
> chart, or they ask for your bank login. I wanted neither."
> Body beats: (1) the problem is forgetting, not overspending - totals don't
> save money, timing does; (2) I built the thing I wanted: a warning two days
> before a charge, a week's notice before an annual one, and a record of what
> you actually saved; (3) no bank login, ever - read-only Gmail or forward
> receipts to a private address; (4) the honest limitation, said out loud: we
> don't cancel with the provider, we get you to the official page and keep the
> receipt - "the app prepares, you decide"; (5) free tier is permanent, Plus is
> $3.99 for 30 days and does not auto-renew, because an app that sells
> forgetting shouldn't auto-charge you; (6) close with the audit method (link
> to the carousel) and the ask: "try it on your own list, then tell me what I
> missed."
> SEO target: "how to track subscriptions without bank login", "cancel
> subscriptions list template".

**K. The counter-take post (the 1-in-5 contrarian, day 9)**
> The worst financial advice on the internet right now: "cancel all your
> subscriptions."
>
> It costs you nothing. You save $40 a month. Then in 30 days you're back,
> and next month you cancel again, and the month after that too.
>
> The real win isn't cancelling. It's not re-subscribing. Which means you need
> to know what's coming before it charges - not a monthly scoreboard of what
> you already did.
>
> What's the last one you cancelled and then went back to? (I'll go first.)

### 11.5 Written cadence + reply protocol
- X: 2-3 short posts a day + 1 thread a week. Post 7-10pm WAT, or the US
  window (7-9am / 12-2pm / 7-10pm EST) for US-facing posts. Threads need all
  15 posts queued at once (no "1/ and then 20 minutes later") - they get most
  of their reach in the first 4 hours.
- Every post ends with a question that needs a real answer. Reply to every
  reply within the hour, with a real answer, never a link. A reply you write
  is a new post; a reply they write is reach you did not pay for.
- IG/TikTok: 4-5 carousels a week, 7-10 slides, save-optimised (educational
  format). Cross-post the same carousel to TikTok photo mode and LinkedIn PDF,
  re-exported for each spec.
- Weekly: 1 long-form write-up (the founder letter format). Monthly: 1
  data piece (this is the SubHalt Subscription Report track, section 2 Phase 3).
- Do not use AI-generated filler. The written voice is the product's trust
  mechanism - a reader can tell in one sentence. Write, don't assemble.

### 11.6 Written-post rules (the claims guardrail still applies)
- Never write "SubHalt cancels your subscriptions" or "stops the charge". The
  line is "warns you before the charge" / "gets you to the official page" /
  "keeps the receipt".
- Never write "connects to your bank". Read-only Gmail or a forwarding
  address - and say so before anyone asks.
- Attribute every statistic in the caption or the post. If it's US survey
  data, label it as US data. Never merge currencies into one number.
- 30 currencies exactly. 34 providers in the catalog. 27 biller integrations,
  89 aliases. No "660+ providers".
- Don't promise the AI is always available; don't promise everything is free
  (the free tier is permanent and real, but Gmail discovery, export and
  assistant actions are Plus).

### Research added this round
- Okara.ai, X marketing for founders (Jun 2026): X surfaces non-follower
  content on fast early engagement; threads that teach one specific thing are
  the most-shared founder format; reply culture = virality; threads build
  followers, single tweets build reach; reach concentrates in the first 4h.
- Creaticalc, X engagement benchmarks (Mar 2026): 1.11% platform median 2026;
  2.18% median for sub-10K accounts (best tier); threads 2.1x a single tweet.
- Heropost, X marketing for brands (Jun 2026): X rewards high-volume posting,
  hot takes, threads, reactive posts, polls, behind-the-scenes; 5-10 posts/day
  beats 1-2.
- Buffer, 10.2M posts analysis: Threads 6.25% vs X 3.6% median engagement;
  X's engagement spread is the widest (best breakout platform, worst floor).
- Socialinsider IG benchmarks (2026): carousels 0.55% engagement, highest
  format; 8-10 slides best.
- Socialinsider LinkedIn benchmarks (2026, 1.3M posts): document posts 7.00%
  vs text 4.50%, polls 4.20%, link posts 3.25%; +14% YoY.
- Postory (May 2026) + PostSmith (Mar 2026) + Growtempo (Aug 2026): LinkedIn
  PDF spec, 8-12 slides, one idea per slide, filename is public, swiping =
  dwell time = distribution.
- Instacarousel (Apr 2026) + Krumzi (Mar 2026): carousel craft rules, 7-10
  slides, hook under 2 seconds, 16pt+ body, DM shares weighted over likes,
  IG re-serves carousels to non-swipers.
- Buffer 1.7M-post study: X = best for breakout (widest variance), Threads =
  steadier long-term community.

## 12. Brand voice + the story engine (the version that actually sounds like us)

> **READ SECTION 13 FIRST.** Section 13 (added later the same night) corrects
> the format: the primary vehicle is CONTENT WRITING, not video, and we
> persuade on why you need this app rather than positioning as the first one.
> The voice rules, the beat sheet and the series bible below still stand;
> the "script" and camera notes are optional and secondary.

_Appended 2026-10-21, after the founder supplied the origin story. Sections 10 and
11 were written in generic content-marketing voice and are demoted. This
section is the source of truth for how SubHalt sounds._

### 12.1 The reference sample (the founder's own words — the voice anchor)

> "One day I and my team members were talking about a product we were working on
> and right there, in the middle of the meeting, I got a debit alert for a
> subscription I don't remember ever making. I can't even track the particular
> account. Because of that I said I was going to check that later and I forgot.
> I didn't learn my lesson. The next month, it happened again. Then it crossed
> my mind to get a tracker, I searched for a good one, but my team insisted
> that we should build one. So that's how SubHalt started and today we have
> users who are enjoying the freedom of [not] getting charged for a forgotten
> subscription."

What that sample proves about the voice:
- It is a **memory, not a message**. First person, past tense, a specific
  scene, a specific day.
- It starts **in the middle of a scene** (a meeting), never with a preamble.
- It has a **human failure in it**: "I didn't learn my lesson."
- The team is a **character** with an opinion ("my team insisted"), not a prop.
- The solution is a **consequence of the story** ("so that's how SubHalt
  started"), never a pivot into a pitch.
- The payoff is about **the user's feeling** (relief), not the feature list.
- One thing to fix in the source line: "the freedom of getting charged" should
  read "the freedom from getting charged" (or "the freedom of never being
  charged for something you forgot").

### 12.2 Voice rules (mechanical, for every post we write)
1. **Open in the scene.** First line = a moment, a place, a notification, a
   line of dialogue. Never "Hi, I'm...", never "Let me tell you about...".
2. **First person, plain words, short sentences.** Fragments are allowed and
   good: "I said I'd check later. I didn't."
3. **Concrete before abstract.** Name the thing: the meeting, the phone on the
   table, the amount, the month, the name you didn't recognise. If you can't
   picture it, cut it.
4. **One story per post.** One scene, one turn, one resolution. Never two
   anecdotes stitched together.
5. **Admit the failure.** The brand is the person who also forgot. This is the
   trust mechanism; do not sand it off.
6. **The solution arrives as a consequence, never as a pivot.** The line that
   sells: "that's how it started" / "so we built it" / "which is why it does
   this one thing".
7. **Brand name comes late.** Rule for video: not before ~30 seconds in, and
   only after the viewer already feels the problem. Research backs this:
   narrative ads with LOW brand prominence outperform (Yildiz & Sever, Intl JMR
   2022) and "character over product" beats feature-led emotional video
   (Nielsen, via Hasan Abdulla 2026). Our own repo already says it: "Sell the
   outcome, don't tour the product" (launch-video/BRIEF.md).
8. **Stats are supporting cast, never the hook.** A number may appear in the
   story, but the first line is always a scene. (This demotes the §11
   stat-led posts to a "proof appendix" - usable inside a story, never as the
   opening line.)
9. **The CTA is one line and low pressure.** A question ("what's the one you
   couldn't name?") beats an instruction. Never more than one ask per post.
10. **Banned vocabulary and moves:** unlock, leverage, game-changer,
    seamless, revolutionary, elevate, "we're excited to announce", "you won't
    believe", "let that sink in", "here's the thing", "honestly", exclamation
    marks, emoji in the body, emoji-heavy captions, three-adjective stacks,
    "Hey guys", rhetorical-question spam, and any sentence that could have been
    written by a fintech blog with the logo removed.
11. **Tone:** honest, dry, a little self-deprecating, never smug. "Night-quiet,
    editorial, real - nothing glitchy, nothing that looks generated" (our own
    brief) is the same instruction in production language.

### 12.3 The scene template (the beat sheet every post follows)

| Beat | Time (video) | What happens | The test |
|---|---|---|---|
| SCENE | 0-3s | Where you were, what was happening. Face up on the table. | Could a stranger picture it? |
| INTERRUPTION | 3-8s | The thing that broke the moment (the alert, the call, the message). | Is it specific? |
| THE PAIN | 8-15s | One detail that makes it hurt: "I couldn't even tell which account it came from." | Does the reader think "same here"? |
| THE SMALL FAILURE | 15-22s | What you did (or didn't do). Honest, human, slightly sheepish. | Would you admit this out loud? |
| THE TURN | 22-30s | The decision - usually made with a person, not alone. | Is there a human in it? |
| THE SOLUTION | 30-45s | The product, as the natural consequence. Low brand prominence. | Does it feel like a story, not an ad? |
| THE RELIEF | 45-60s | What it feels like now, in the user's words. | Is the feeling concrete? |
| THE ASK | last 5s | One question. | Could you answer it? |

### 12.4 The story, polished (three lengths, same spine)

**A. Video script (60-70s, talking head, one take)**
> [Mid-sentence, no greeting. Phone face up on the table.]
>
> "We were in a meeting. Mid-sentence. My phone buzzed.
>
> It was a debit alert. For a subscription. I didn't recognise the name.
>
> And that was the part that got me. I couldn't even tell you which of my
> accounts it came from. Not that I forgot to cancel something. I didn't know
> what it was.
>
> I said, I'll check that after this meeting.
>
> I didn't. I didn't check it that week. The next month, another one. And I
> still hadn't learned my lesson.
>
> So I went and looked for an app to do it for me. Every one of them wanted my
> bank login. Or they wanted me to track it myself, which was the entire
> problem.
>
> And my team said: why are we shopping? Let's just build it.
>
> That's how SubHalt started. Not because subscriptions are a big market.
> Because every person at that table had been charged for something they
> couldn't name.
>
> SubHalt does one thing. It tells you before the money leaves. Two days
> before a monthly one. A week before an annual one. And it keeps the receipt
> of what you saved.
>
> Now people wake up to nothing. No surprise. Just a Tuesday.
>
> [pause]
>
> What's the one subscription you couldn't name? I'll start with mine:
> [real one]."

*Placeholders to fill with real facts: the amount on the alert, the real
second instance, the real name you're disclosing. Never invent them.*
*Shot notes: one take, no music, no graphics, natural light, phone on the
table in frame 1. Captions burned in (sound-off safe). No brand card until the
last 3 seconds.*

**B. X thread (9 posts)**
> 1/ We were in a meeting. Mid-sentence. My phone buzzed on the table.
> 2/ It was a debit alert. For a subscription. I didn't recognise the name.
> 3/ The part that bothered me: I couldn't even tell you which of my accounts
> it came from.
> 4/ I said, "I'll check that after this meeting." I didn't. I didn't check it
> that week.
> 5/ The next month, another one. I still hadn't learned my lesson.
> 6/ So I went looking for an app to do it for me. Every one wanted my bank
> login. Or they wanted me to do the tracking myself, which was the entire
> problem.
> 7/ My team said: why are we shopping? Let's build it.
> 8/ That's SubHalt. It tells you before the money leaves. Two days before a
> monthly charge, a week before an annual one. And it keeps the receipt of
> what you saved.
> 9/ What's the one subscription you couldn't name? I'll go first: [yours].

**C. One paragraph (the /about page, the link-in-bio, the email header)**
> We were in a meeting when my phone buzzed with a debit alert for a
> subscription I didn't recognise. I couldn't even tell which account it came
> from. I said I'd check it later. I didn't, and the next month it happened
> again. So I went looking for an app that could track it for me, and my team
> said we should just build one. SubHalt does that: it tells you before the
> charge, and it never asks for your bank login.

### 12.5 The show: "The Debit Alert" (the recurring series)

Why a series and not a feed: a standalone post is evaluated once, lives 24-48
hours, and dies. A series accumulates return viewers, and returning viewers
are the highest-quality retention signal a recommendation algorithm can see.
57% of consumers say they want brands to publish original content series
(Sprout Social Q2 2025); Nielsen's 2024 digital-engagement work puts series
retention up to 40% above one-off content; interactive series drive 55% more
shares (HubSpot); and Meta has been testing a "Series" hub for Reels since
mid-2026 that bundles episodes on your profile, so build the episodes in a way
that can be collected later. Aéropostale's docu-series ("The Intern Diaries")
ran 2x the engagement of their regular IG content - a show, not a campaign.

**The premise:** every episode is a real forgotten charge - the founder's, a
team member's, a user's, a friend's - told in the beat sheet above, ending
with the solution as a natural consequence. The app is the constant, never the
subject.

**The bible (lock this before episode 1, per series-bible practice):**
- **Format signature:** the same opening line every episode - "That's a debit
  alert I didn't make." - plus the same 1-second sound sting. Recognisable in
  the first half second.
- **Length:** 45-60s. Vertical 9:16. Captions burned in. One take, no music
  bed, real room sound.
- **Cadence:** one episode a week, same weekday, same window (7-10pm WAT).
  Name them in advance: "The Debit Alert, Episode 4".
- **Recurring host:** the founder, always. The team appears as guests in their
  own episode.
- **Cliffhanger + interaction:** every episode ends with the next question
  ("next week: the one that was [X]"), and every episode carries a poll or
  comment prompt: "What was your most recent debit alert you didn't make?"
- **Pilot:** four episodes before scaling anything. One KPI: episode-over-
  episode retention. Set the naming/UTM convention before episode 1
  (episode number in every link), because retrofitting analytics after
  episode 5 is how series die.
- **Sourcing pipeline (this is what makes it endless):** founder's own
  charges -> each team member's worst one -> user-submitted stories (with
  permission) -> friends and family -> "the group chat where someone said they
  forgot to cancel" -> the receipts people forward to SubHalt.

**Episode ideas (hooks only - the story does the work):**
1. "The meeting one." (the origin story - Episode 1)
2. "The one that was [₦/$] and nobody could explain it." (a teammate's)
3. "My user's first SubHalt email was a screenshot of a charge she couldn't
   name." (a user story, permissioned)
4. "The service that shut down and kept charging." (the Showmax-style
   episode - rotation is rational; a dead platform can still bill you)
5. "The one my own mother found." (family - the highest-closeness story in
   the series; use sparingly, and only once)

### 12.6 Where the old pack still fits (demoted, not deleted)
The §11 stat-led posts are now **proof appendix** material: a stat can appear
*inside* a story (the alert, the month, the amount, and one sourced line like
"the average American carries 2.6 of these"), but never as the first line.
The §10 video week becomes the **season-one production schedule** for the
series: Day 1 becomes Episode 1 (the origin story, filmed properly), and the
"24-hour audit bet" becomes Episode 2's engine (the founder runs the audit
live on camera; the result is Episode 3).

### 12.7 Research added this round
- Yildiz & Sever, "Investigating the Effects of Narrative Advertising in a
  Real-Life Setting" (Intl JMR 2022, Instagram sponsored posts): narrative ads
  beat non-narrative; the strongest performers are narrative ads with low
  brand prominence.
- "Fact versus Fiction: Blending Storytelling with Product Attributes" (JACR
  2024): story + argument work together; don't force product attributes in and
  don't dump them at the end.
- Xu, meta-analysis, narrative vs statistical evidence (Health Communication
  2023, 50 studies): narrative is at least as effective overall, and
  significantly better in some contexts; the takeaway for us is that the
  story is not a soft option.
- Nielsen (via Hasan Abdulla, Jun 2026): emotional video content produces
  significantly stronger brand recall than informational content; lead with
  character and conflict, not product features.
- Hasan Abdulla, cinematic brand story planning (Jun 2026): three-act
  structure; brands that lead with product in emotional video underperform;
  open on the viewer's world, not the company's.
- eMarketer (May 2025): marketers lean into storytelling over branded content
  to fight ad fatigue; storytelling is the top creative priority (64%).
- AG Creators Hub, UGC script structure (Apr 2026): hook 0-3s, no greeting;
  body = problem then product as natural discovery; one CTA. "If the script
  sounds like an ad, it doesn't work."
- AutoAdify, episodic content (2026): 57% want brand series (Sprout Social
  Q2 2025); standalone posts live 24-48h, series compound; Meta's Reels
  Series hub is in testing since mid-2026.
- Influencers-Time, episodic content (Dec 2025 + Oct 2026): Nielsen 2024 -
  digital series up to 40% better retention; HubSpot - interactive series
  55% more shares; a real series needs consistent hook structure, recurring
  host, thread, format signature; start with a 4-episode pilot and one KPI
  (episode-over-episode retention); set naming/UTM before episode 1.
- Digiday, Aeropostale "The Intern Diaries" (Aug 2026): 6-episode docu-series
  across YouTube and TikTok; 2x engagement vs the brand's regular IG content.

## 13. Content writing mode (supersedes the video framing in section 12)

_Appended 2026-10-21, late. Two corrections from the founder: (a) the vehicle
is CONTENT WRITING - prose that reads like a Hollywood scene but is true, so
the reader visualises their own life in it; not video, not scripts. (b) We are
not launching as "the first subscription app" - we persuade on why you need
THIS one. Section 12's video beat-sheet and camera notes remain useful for
the "The Debit Alert" series, but the primary craft here is the written
piece._

### 13.1 Prose voice rules (prose, not video)
- **Write the scene, not the summary of the scene.** "My phone lit up on the
  table" beats "I received an unexpected subscription charge."
- **Prose rhythm:** short paragraphs, one to three sentences, a white line
  between beats. A fragment is a legitimate sentence ("Not one of them said:
  hey, this is going to charge you in two days.").
- **Sensory before analytical.** Room, table, screen light, the sound of a
  notification. Then the meaning.
- **The reader should recognise themselves by the end of paragraph two.**
  That is the test of the piece - not "is this well written" but "did I
  think, oh, that's me."
- **No video language in the writing:** no "cut to", no timestamps, no
  "scene", no "shot", no "in this frame". Write the way it reads on a page.
- **One piece, one argument.** The origin story piece argues "this happened
  to me". The persuasion piece argues "here is the difference". Never both.
- **End on the reader, not on us.** The last line is about their life (their
  Tuesday, their relief, their question), or one low-pressure ask.
- **The last line of the founder's own sample, corrected:** "today we have
  users who are enjoying the freedom of getting charged for a forgotten
  subscription" -> "...who are enjoying the freedom of never being charged
  for something they forgot."

### 13.2 Comparisons are out (rule, not a jab)
- **We do not put other apps down, and we do not frame our value against
  theirs.** No competitor names, no "most apps", no "unlike X", no "we are
  not the first app but". Persuasion is not subtraction: it means making the
  problem real in the reader's own words and then plainly stating what we do
  about it.
- The earlier draft of the origin story had a passage putting other apps down
  (bank details vs "a filing cabinet"). It was cut. The reason is brand
  integrity, not politeness: SubHalt's whole pitch is honesty (we never
  cancel with the provider, we never need a bank login, we never auto-renew),
  and a brand that says that cannot then mock a competitor for asking you to
  type. The competitor facts stay in `docs/MARKETING-FEATURE-AUDIT.md` for
  our own heads; they do not go in the content.
- The "persuasion" brief from the founder is a **rule for how we talk** (convince
  them on why they need this one), not a request for a separate comparative
  piece. Every piece is about ours and the reader's life.

### 13.3 The positioning rule for every piece
- We never claim to be first, new, or the only subscription app - and we never
  position against anyone. No comparisons, no competitor names, no takedowns.
- We talk about ours and about the reader's life, and we persuade by making
  the problem feel real in their words and then stating plainly what we do
  about it.
- The persuasion is behavioural: **the moment a subscription can quietly take
  your money is not the day it charges you, it is the day you stop paying
  attention to it.** That observation is ours; nobody else's product needs to
  be in the frame.
- State our value as fact, not boast: "It tells you before the money leaves."
  "It finds the ones you never listed." "It keeps the receipt of what you
  saved." Flat, specific, verifiable - and then stop.
- The reader's own words carry the persuasion (debit alerts, meeting tables, a
  Tuesday that stays a Tuesday). The product is what we answer with.


---

### 13.4 PIECE ONE - the origin story (written; /about page, or the anchor
post of the account, or the first long LinkedIn/X piece)

> **Canonical copy lives in `MARKETING-PLAN-CONTENT.md` Part 2.1.** Edit the
> wording there; this section stays as the strategy record only.

> **It happened in a meeting, which is the part that still annoys me.**
>
> We were halfway through talking about a product, and my phone lit up on the
> table. Face up. A debit alert.
>
> Not a large one. That isn't the part that got me. The part that got me was
> reading the name of the charge and not recognising it. Not "oh, I forgot to
> cancel that." Worse than that. I couldn't tell you which of my accounts it
> came from. I have several. I had no idea.
>
> I said, "I'll check that later." I checked that later. I checked that never.
> And the next month there was another one I didn't recognise, and by then I
> wasn't even surprised. I was just annoyed at myself.
>
> So I went looking for an app. I did the thing everyone does: I downloaded
> four. Two of them wanted my bank details before they'd show me a single
> subscription, which is a strange thing to ask when the whole problem is
> that I can't remember what I'm paying for. The other two were fine in the
> way a filing cabinet is fine: you put things in it yourself, it holds them
> for you, and it will never once tell you what's about to happen.
>
> None of them did the thing I actually wanted. Not one of them said: hey,
> this is going to charge you in two days.
>
> I didn't need a chart. I'd had a spreadsheet. A spreadsheet is a nicer way
> of feeling informed. What I wanted was a knock on the door.
>
> My team were watching me do all of this, and one of them said, "Why are we
> shopping? Let's build it."
>
> That's how SubHalt started. Not because we thought we were going to
> revolutionise anything. Because everyone at that table had been charged for
> something they couldn't name, and one of us decided that was embarrassing
> enough to fix.
>
> We built it to do the part after the total. Most apps tell you what you
> spent. Your bank statement tells you what you spent too - later, and worse.
> SubHalt tells you before the money leaves. Two days before a monthly
> charge. A week before an annual one, because a year is a bigger decision
> than a month. It finds the ones you never listed by reading your receipts
> instead of your memory. And when you cancel something, it keeps the
> receipt, so you can point at the number.
>
> Most days now, nothing happens. That's the whole product. You open it, you
> close it, and your Tuesday stays a Tuesday.

*Fill in before publishing: the real amount on that first alert, the real
second instance. Never invent them. One take of the real number beats a
perfect paragraph.*

---

### 13.5 PIECE TWO - why you need it (blog, LinkedIn, X long-post, the
/features page intro)

> **Canonical copy lives in `MARKETING-PLAN-CONTENT.md` Part 2.2.** Edit the
> wording there; this section stays as the strategy record only.

> **Your bank statement already knows.**
>
> Somewhere, a piece of software you forgot you signed up for knows exactly
> how much it takes from you, on what day, and it has known for months. You
> just can't see it.
>
> So you do the sensible thing. You download an app. Or you make a
> spreadsheet. And now you have a nicer view of a problem you already
> understood: the money leaves, and then you find out.
>
> That's the order of events backwards.
>
> The moment a subscription can quietly take your money is not the day it
> charges you. It's the day you stop paying attention to it. The charge is
> the last second of a long silence. Which means an app that shows you a
> total on the 30th has shown you a total about something that already
> happened, and an app that emails you afterwards has made you pay for the
> lesson.
>
> The only useful moment is the one before. While you're still holding the
> money and nobody has taken it yet.
>
> That's the part we built. Two days before a monthly charge. A week before
> an annual one. A nudge further out that just asks: still worth it? And
> then, when you do cancel something, it keeps the receipt. Not a boast.
> Just a number you can point at: you didn't spend that.
>
> We are not the first subscription app. There are good ones, and if all you
> want is a tidy list with a chart on top, one of them will do that job
> properly. This one is for the person who has looked at a debit alert and
> thought: I didn't even know that was mine.
>
> That is a small group. It is also the group we build for.

---

### 13.6 PIECE THREE - the short post (X, LinkedIn, the pinned post; ~120
words)

> **Canonical copy lives in `MARKETING-PLAN-CONTENT.md` Part 2.3.** Edit the
> wording there; this section stays as the strategy record only.

> It happened in a meeting, which is the part that still annoys me.
>
> My phone lit up on the table. A debit alert. For a subscription I didn't
> recognise. Not "oh, I forgot to cancel it." Worse: I couldn't tell you
> which of my accounts it came from.
>
> I said, "I'll check that later." I never did. The next month, another one.
>
> Then I watched my team watch me download four apps and give up on all four,
> and one of them said: why are we shopping? Let's build it.
>
> That's how SubHalt started. The rest is the boring part: it tells you
> before the money leaves, and it never asks for your bank login.
>
> What's the last charge you couldn't name? I'll start with mine.

---

### 13.7 The written series (adapted from section 12's show)
"The Debit Alert" still works - as a **written column**, which is cheaper and
more portable:
- One piece a week, 600-900 words, each one a real forgotten charge (the
  founder's, a team member's, a user's, a friend's), written in the beat
  order of section 12 but as prose, never as a script.
- Same opening signature, same closing question, visible episode numbers
  ("The Debit Alert, episode 4") so people can follow it and so retention is
  measurable episode over episode.
- Each piece is then cut down: the thread (9-12 posts), the carousel (8
  slides), the short post (section 13.6 shape), the email.
- The sourcing pipeline is the same and it is the part that makes this
  endless: founder's own charges -> each team member's worst one ->
  permissioned user stories -> friends and family -> the group chat where
  someone admits they forgot to cancel.
- Story integrity rule: the pain comes first and the app arrives last, in
  the last quarter of the piece. If the reader can delete the brand name
  from paragraph 6 and the piece still works, that's the goal - then add it
  back and watch the trust double.

### Research added this round
- Confirms the "persuade, don't educate" logic: brands that lead with
  character and conflict beat product-led storytelling (Nielsen via Hasan
  Abdulla 2026); narrative ads with low brand prominence outperform
  (Yildiz & Sever 2022); story + argument work together rather than
  substituting (JACR 2024). A written piece that carries one argument and
  lets the brand name arrive late is the same principle in text form.
- The self-consistency rule above (never attack manual entry while our free
  tier is manual-first) is a positioning-integrity rule; it also matches the
  guardrail set in the marketing feature audit section 7, which forbids
  implying capabilities we don't have (we don't cancel with a provider, we
  don't need a bank login, we don't auto-renew).

## Log
- _2026-10-21 — File created. Verdict delivered: giving the "post the ad film"
  approach the trust engine restructure (baseline + owned intent assets +
  organic content engine + community/earned + in-app loops; paid LAST, gated).
  Next action: the Week 1 checklist in §5 — especially the free Subscription
  Audit tool and the first 10 /cancel/[provider] programmatic pages._
- _2026-10-21 (evening) — §9 added: founder-led is the decision (team personas
  and brand account wait); topic-first posting confirmed with ratio
  correction; zero-follower mechanics (seed cohort, first-frame specificity,
  photo-mode search bait, anti-mistakes, cadence, honest expectations,
  app-introduction sequence) researched and encoded._
- _2026-10-21 (late) — §10 added: the 7-post Week-1 pack (audit carousel,
  confession, inventory method, trial-trap story, cancellation search-bait,
  24-hour audit bet, damage reveal), the daily operating protocol (post
  window, first-hour replies, 15 min of niche commenting, re-edited
  cross-posts, per-post logging), and honest week-1 view/follower bands.
  No app pitch in week 1; the app arrives around day 10._
- _2026-10-21 (night) — §11 added after "give me interesting posts, write-ups
  are fine": the written engine (X threads 2.1x, sub-10K accounts are X's best
  engagement tier at 2.18%, carousels beat text on IG/LinkedIn), the one
  write-up-to-seven-assets rule, a 12-line hook library, and 10 full
  ready-to-post written drafts (X thread, hot take, trial-fact post, poll,
  2 carousels, Showmax fear post, LinkedIn PDF, receipts post, founder
  write-up, counter-take) plus cadence, reply protocol, and claims rules._
- _2026-10-21 (late night) — §12 added, and it supersedes §10/§11 as the voice
  source of truth. The founder's origin story is the voice anchor; voice rules
  decoded from it (open in the scene, first person, human failure, team as
  character, solution as consequence, brand name late, stats as supporting
  cast, one low-pressure ask, banned-words list); the 8-beat scene template;
  the origin story rewritten in three lengths (70s video script, 9-post X
  thread, one-paragraph); and the "The Debit Alert" episodic series spec
  (format signature, weekly cadence, cliffhanger + poll, 4-episode pilot,
  sourcing pipeline, 5 episode ideas) grounded in 2026 episodic-content
  research (57% want brand series, +40% retention, 55% more shares)._
- _2026-10-21 (night, final) — §13 added, superseding the video framing:
  content-writing mode (prose rules: write the scene not the summary, short
  paragraphs, sensory before analytical, no video language, end on the
  reader); the retired competitor jab ("wanted me to track it myself" - our
  free tier is manual-first, so it was a self-own) replaced with the real
  difference (timing + discovery); the persuade-don't-educate positioning
  rule; and three finished written pieces: the origin story, the persuasion
  piece ("Your bank statement already knows"), and the 120-word short post,
  plus the written adaptation of "The Debit Alert" column._
- _2026-10-21 (final) — Copy moved to the new companion file
  `MARKETING-PLAN-CONTENT.md` per instruction ("put your reply in another
  file under marketing plan.md"). That file is now the canonical home for
  the voice reference sample, the prose voice rules, the retired competitor
  jab and its replacement, the three finished written pieces, the written
  column spec and the open items. This file keeps strategy, channels,
  metrics and the decision log; the piece bodies here now point to the
  content file._
- _2026-10-21 (correction) — Two founder corrections, applied in both files:
  (1) "persuasion" is a RULE for how we talk (convince them they need this
  one), not a request for a comparative piece; (2) no comparisons, no
  competitor names, no putting other apps down - we only talk about ours and
  why they need it, and persuasion is not subtraction. §13.2 and §13.3 were
  rewritten as rules; the comparative passages were cut from the origin
  story; Piece 2 in the content file was replaced with "The part that
  actually saves money is the four days before the charge"._
---

_Feel free to direct me ("put this into MARKETING-PLAN.md", or "make me a sub
file for the creator brief, and link from here"). Otherwise, everything new
appends here._
