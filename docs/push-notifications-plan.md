# Task: Daily verse push notifications for howgodspeakstous.com

## Status (October 25, 2026): built

Decisions made with the owner:
- Send time: 7am Chicago time all year. The workflow runs at 12:00 and 13:00 UTC; the script sends only between 7 and 11am Chicago time and records the date in KV (`meta:last-sent`), so exactly one run sends.
- Sign-up button: footer, contact page and install page (`src/components/PushSignup.astro`).
- VAPID subject: `mailto:howhespeakstous@gmail.com`.
- Wording: title "Today's Verse", body "<passage>: <verse text>" (trimmed to 140 characters).
- New `/privacy` page, plus a section on the About page.

Changes from the original plan below:
- Subscriptions are also stored in KV key metadata, so the morning send gets all of them with one `list` call per 1,000 sign-ups.
- Cloudflare's KV API token permission covers the whole account, not a single namespace.
- Subscribe and unsubscribe are one Pages Function: `functions/api/push/[action].js`.


Plan only. Do not write code until this plan is reviewed. Read the codebase first, confirm the assumptions below, and come back with any conflicts or questions.

## Context

- The site is now an installable PWA (see `docs/pwa-development-plan.md`). The service worker lives in `src/sw.ts` and already has a placeholder comment for `push` and `notificationclick` listeners.
- Static Astro build on Cloudflare Pages. Server code runs as Cloudflare Pages Functions in `functions/api/` (`contact.js`, `contentful-webhook.js`).
- A GitHub Action (`.github/workflows/daily-rebuild.yml`) already rebuilds the site just after midnight Chicago time using a Cloudflare deploy hook.
- "Today" is defined in `America/Chicago` (`src/lib/dates.ts`).
- Daily verses are often entered ahead of time and hidden until their date. That is why notifications go out **on a schedule for today's verse**, not when a verse is published in Contentful.
- The audience is mostly older, non-technical church members on phones. Signing up and turning it off must be simple and obvious.

## Goal

People who opt in get one notification each morning with that day's verse. Tapping it opens that day's verse page in the app.

## How it works

```
Phone ── taps "Get the daily verse" ──> /api/push/subscribe ──> Cloudflare KV (sign-up list)

Every morning:
GitHub Action ──> Contentful (today's verse?) ──> reads sign-up list from KV
              ──> sends push to each phone ──> removes expired sign-ups

Phone's service worker ──> shows notification ──> tap opens /daily-verses/YYYY-MM-DD
```

## Phase 1: Investigate before building

1. Confirm how Pages Functions are deployed and how env vars and bindings are set (dashboard or a `wrangler.toml`; there isn't one today).
2. Confirm the Cloudflare plan includes Workers KV, and which account and project the namespace should live in.
3. Confirm how a daily verse can be looked up by date from a Node script using the existing delivery token (reuse the query logic in `src/lib/contentful.ts` if possible).
4. Check whether the site has a privacy page or notice that should mention notification sign-ups.
5. Check the current `/install` page and homepage layout to decide where the sign-up button goes.

## Phase 2: Requirements

### 1. Keys (one-time setup, done by the site owner)

- Generate a VAPID key pair with `npx web-push generate-vapid-keys`.
- **Public key:** safe to ship to the browser. Expose it as a build-time env var, e.g. `PUBLIC_VAPID_KEY`.
- **Private key:** secret. Store it only as a GitHub Actions secret (`VAPID_PRIVATE_KEY`). Never put it in the site build.
- Contact email for the VAPID `subject` (e.g. `mailto:...`). Ask the owner which address to use.
- Write the setup steps for a non-technical owner, like the deploy-hook instructions.

### 2. Sign-up button (browser)

- A "Get the daily verse each morning" button. Proposed places: the homepage near Verse of the Day, and the `/install` page. Confirm placement with the owner.
- Ask for permission **only after a tap**. Never on page load.
- States the button must handle:
  - **Not supported** (old browser): hide the button.
  - **iPhone in Safari, not installed:** push only works from the home-screen app (iOS 16.4+). Show "Install the app first to get daily reminders" with a link to `/install`.
  - **Permission denied:** say how to turn it back on in phone settings. Don't keep asking.
  - **Signed up:** show "You'll get the daily verse each morning" with a clear **Turn off** button.
- Subscribe with `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, then POST the subscription to `/api/push/subscribe`.
- Turning off calls `subscription.unsubscribe()` and POSTs to `/api/push/unsubscribe`.
- Same design rules as the PWA work: matches site styles, light and dark mode, keyboard and screen-reader accessible, respects reduced motion.

### 3. Storage (Cloudflare Pages Functions + KV)

- New KV namespace, e.g. `PUSH_SUBSCRIPTIONS`, bound to the Pages project.
- `functions/api/push/subscribe.js` (POST):
  - Validate the body: an `endpoint` that is `https://` on a known push service host (Google FCM, Mozilla, Apple, Microsoft), plus `keys.p256dh` and `keys.auth`. Reject anything else and cap the body size.
  - Key: SHA-256 hash of the endpoint, so re-subscribing overwrites instead of duplicating.
  - Value: `{ subscription, createdAt }`. No names, emails, or other personal data.
- `functions/api/push/unsubscribe.js` (POST): delete by endpoint hash.
- Basic abuse protection: reject non-JSON and oversized requests. Consider Cloudflare rate limiting on `/api/push/*`.

### 4. Morning send (GitHub Action)

- New workflow `.github/workflows/daily-verse-push.yml`, with `schedule` plus `workflow_dispatch` for manual tests.
- **Time:** GitHub cron is UTC only and Chicago shifts with daylight saving. Proposal: `0 13 * * *` (7am CST, 8am CDT). Alternative: two crons, with the script exiting unless it's 7am in Chicago. Ask the owner for their preferred time. Note that GitHub scheduled runs can start 5 to 30 minutes late.
- A Node script (`scripts/send-daily-push.mjs`) that:
  1. Computes today's date in `America/Chicago`.
  2. Fetches today's daily verse from Contentful. **If there isn't one, exits without sending.**
  3. Lists all sign-ups from KV via the Cloudflare REST API (paginated).
  4. Sends to each with the `web-push` npm package. Payload: `{ title, body, url }`, where body is the verse reference plus a short excerpt and url is `/daily-verses/YYYY-MM-DD`. Set a TTL of a few hours so a phone that was off doesn't get yesterday's verse late.
  5. Deletes sign-ups that return 404 or 410 (uninstalled or turned off).
  6. Logs counts only (sent, removed, failed), never subscription data.
- Secrets: `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, a `CLOUDFLARE_API_TOKEN` scoped to KV read/write on that namespace only, and the Contentful space ID and delivery token.
- **Why GitHub Actions instead of a Cloudflare cron:** Pages Functions can't run on a schedule, and Node's `web-push` package is well tested. It would need replacing with a Web Crypto implementation inside Workers. If a Cloudflare-only setup is preferred later, a small scheduled Worker could replace this job.

### 5. Service worker (`src/sw.ts`)

- `push` listener: parse the payload and call `showNotification(title, { body, icon: '/pwa-192x192.png', badge, data: { url }, tag: 'daily-verse' })`. The `tag` means a newer verse replaces an unread older one instead of stacking.
- `notificationclick` listener: close the notification. Focus an open app window and navigate it to `url`, or open a new window.
- `pushsubscriptionchange` listener: resubscribe and POST the new subscription, so sign-ups survive browser key rotation.
- Fallback if a push arrives with no payload: show a generic "Today's verse is ready" notification linking to `/`.

## Out of scope

- Choosing topics, times, or frequency per user. Everyone gets one daily verse at the same time.
- Notifications for new blog posts or resources. The same system could support these later.
- Any admin dashboard. Counts in the Action logs are enough.

## Phase 3: Verification plan

1. **Local:** with `astro build` + `astro preview`, subscribe in desktop Chrome, run the send script manually against a test KV namespace, and confirm the notification appears and the tap opens the right page.
2. **Edge cases:** no verse today (nothing sent), denied permission, Turn off (removed from KV), and an expired subscription (removed after a 410).
3. **Production test:** run the workflow manually with `workflow_dispatch` and confirm delivery.
4. **Real devices:** an Android phone in Chrome, and an iPhone with the app installed to the home screen. Also confirm Safari without the app installed shows the "Install the app first" message.
5. **Security check:** the private key and API token never appear in `dist/` or browser code (search the build output).

## Open questions for the owner

1. What time should the notification arrive?
2. Where should the sign-up button go: homepage, `/install`, or both?
3. What contact email should go in the VAPID subject?
4. What should the notification text look like? Proposal: title "Today's Verse", body "John 3:16: For God so loved the world…".
5. Should the privacy or about page mention that sign-ups are stored, even with no personal data?

## Rough size

About the same as the PWA work: one UI component, two small Pages Functions, one workflow plus a Node script, and around 40 lines in the service worker. There is also a one-time key and secret setup for the owner. No new paid services.
