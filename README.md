# How God Speaks To Us

A daily devotional and Bible study site: **[howgodspeakstous.com](https://howgodspeakstous.com)**

Each day has a verse with a short devotional. There are also Bible study blog posts and sermon resources (PowerPoints and PDFs). Readers can install the site on their phone like an app, read pages they've already opened without internet, and get the day's verse as a notification each morning.

Most readers are church members reading on their phones, many of them not technical. Keeping things simple and reliable for them comes before clever features.

---

## What readers can do

| Page | What it is |
| --- | --- |
| `/` | Home: today's **Verse of the Day**, recent verses and recent posts |
| `/daily-verses` | Every past daily verse, with tag filtering and pagination |
| `/daily-verses/YYYY-MM-DD` | One day's verse and devotional |
| `/blog`, `/blog/[slug]` | Bible study posts, with multi-tag filtering |
| `/resources`, `/resources/[slug]` | Sermon resources, with tag filtering. PDFs and PowerPoints display in the page and can be downloaded |
| `/about` | What the devotional is about, plus the app and notifications |
| `/contact` | Contact form (emails the site owner) and the notification sign-up |
| `/install` | Step-by-step "add to home screen" instructions for iPhone and Android |
| `/privacy` | Plain-language privacy notice |
| `/offline` | Shown in the app when a page isn't saved and there's no internet |

**Also:**

- **Installable app.** It can be added to the home screen on iPhone and Android, and opens full screen with its own icon.
- **Works offline.** Pages you've opened are saved on the device.
- **Daily verse notification.** An optional notification arrives at 7am Central time. Tap it to open that day's verse.
- **Update prompt.** When a new version is deployed, a small "New content available — Refresh" message appears.

---

## How it works

```
                       ┌──────────────┐  publish   ┌──────────────────────┐
  Site owner ────────► │  Contentful  │ ─webhook─► │ /api/contentful-     │
  (writes content)     │  (content)   │            │ webhook (Pages Fn)   │
                       └──────┬───────┘            └──────────┬───────────┘
                              │ read at build time            │ deploy hook
                              ▼                               ▼
  GitHub push to main ─► ┌──────────────────────────────────────────────┐
  Daily rebuild 12:10am ─►│ Cloudflare Pages: `astro build` → static site │
  (GitHub Action)        └──────────────────────┬───────────────────────┘
                                                ▼
                         howgodspeakstous.com  (HTML + service worker)

  Daily verse notification (GitHub Action, 7am Chicago)
    Contentful (today's verse?) + Cloudflare KV (sign-ups) ─► push to phones
```

### The site is built ahead of time

- **Fully static.** [Astro](https://astro.build) 4 builds every page to HTML on Cloudflare Pages, using content from Contentful's read-only API. Readers' browsers never talk to Contentful, and no Contentful token reaches the browser.
- **One fetch per content type.** `src/lib/content-catalog.ts` fetches each content type once per build and shares it across all pages, which keeps Contentful API usage low.

### What triggers a rebuild

1. **Publishing in Contentful.** A Contentful webhook calls `functions/api/contentful-webhook.js`, which calls the Cloudflare deploy hook.
2. **Pushing to `main`** on GitHub.
3. **Every night at 12:10am Chicago time.** `.github/workflows/daily-rebuild.yml` rebuilds so the homepage switches to the new day's verse even when nothing was published.

### What "today" means

"Today" is always the date in **America/Chicago** (`src/lib/dates.ts`), not UTC. Using UTC would flip to tomorrow's verse around 7pm Central.

Verses dated in the future are hidden until their day, so verses can be entered weeks ahead. The homepage is only as current as the last build, which is why the nightly rebuild exists.

### Content model (Contentful)

| Content type | Fields used by the site |
| --- | --- |
| `dailyVerse` | `date`, `passage` (e.g. "1 Corinthians 2:10 ESV"), `verse` (rich text), `description` (rich text), `tag` |
| `blogPost` | `title`, `slug`, `excerpt`, `content` (rich text), `featuredImage`, `author`, `publishDate`, `tags` |
| `resource` | `title`, `slug`, `description`, `files` (PDF/PowerPoint assets), `publishDate`, `tags` |

Images come from `images.ctfassets.net` and files from `assets.ctfassets.net`. PowerPoints are shown with Microsoft's Office web viewer.

---

## The app (PWA)

The app is built with [`@vite-pwa/astro`](https://vite-pwa-org.netlify.app/frameworks/astro), which uses Workbox. The service worker is custom code in `src/sw.ts`, built in `injectManifest` mode.

| What | How it's cached | Why |
| --- | --- | --- |
| App shell (CSS, JS, icons, `/offline`) | Precached at install | Small, and versioned by the build |
| `/` and `/daily-verses/*` | **Network first** (3s timeout), cached copy as fallback | Never show yesterday's verse to someone who's online |
| Other pages | Stale-while-revalidate | Instant from cache, refreshed in the background |
| Contentful images | Cache first, max 60 images / 30 days | Images rarely change |
| Google Fonts | Standard Workbox recipe | |
| PDFs/PowerPoints, `/api/*`, other sites | **Not cached** | Files are large, and "Download" covers reading them offline |

**Update prompt.** A new version waits until the reader taps **Refresh** in the update message (`src/components/UpdateToast.astro`), and the app checks for updates hourly. Nothing changes under the reader without them tapping.

**Install.** Install prompting lives in `src/components/InstallPrompt.astro`:

- On Android/Chrome, the browser's own install prompt is offered.
- On iPhone Safari, short "Share → Add to Home Screen" instructions are shown instead.
- The banner only appears from the second visit on, stays away for 90 days after it's dismissed, and never shows inside the installed app.

**iPhone layout.** In the installed app, the iPhone status bar overlays the page (`black-translucent`). The navbar is pinned and padded for the notch, and the heroes are pushed down to match. This is done with the `.is-standalone` class, set in `src/components/PwaHead.astro` before the page renders.

**Icons.** Icons are generated from `public/icon.svg` with `npm run icons` (config: `pwa-assets.config.ts`).

---

## Daily verse notifications

```
Phone taps "Get the daily verse each morning"
  └─► POST /api/push/subscribe ─► Cloudflare KV (PUSH_SUBSCRIPTIONS)

GitHub Action at 12:00 and 13:00 UTC
  └─► scripts/send-daily-push.mjs
        ├─ only between 7–11am Chicago time, and only once per day (KV key meta:last-sent)
        ├─ looks up today's verse in Contentful; none → sends nothing
        ├─ lists all sign-ups from KV, sends a Web Push to each
        └─ deletes sign-ups whose phone has unsubscribed (HTTP 404/410)

Phone's service worker shows "Today's Verse — <passage>: <verse>"
  └─► tapping opens /daily-verses/YYYY-MM-DD
```

### Why two runs

GitHub schedules run in UTC, and Chicago changes clocks twice a year, so the job runs at both 7am CDT and 7am CST. The script makes sure exactly one of them sends.

### Files

| File | Role |
| --- | --- |
| `src/components/PushSignup.astro` | Sign-up button (footer, contact page, install page) |
| `functions/api/push/[action].js` | Saves (`subscribe`) or removes (`unsubscribe`) sign-ups in KV |
| `src/sw.ts` (bottom) | Shows the notification and opens the verse page when it's tapped |
| `scripts/send-daily-push.mjs` | The morning send |
| `.github/workflows/daily-verse-push.yml` | Runs the morning send on a schedule |
| `src/config/push.mjs` | Public notification key, contact email, API paths |

### The sign-up button's states

The sign-up button adapts to the device:

- Normal: "Get the daily verse each morning".
- Signed up: a confirmation and **Turn off**.
- Notifications blocked: how to re-enable them in settings.
- iPhone Safari: "add to home screen first". iOS only allows notifications from the installed app, on iOS 16.4 or later.
- Older iOS: an "update iOS" message.

### What's stored

Only the browser's push address and its encryption keys are stored, with no names or emails (see `/privacy`). Each sign-up is also stored in the KV key's metadata, so one `list` call returns up to 1,000 sign-ups. That keeps the morning send well inside Cloudflare's free KV limits.

### Notification keys (VAPID)

The public key is committed in `src/config/push.mjs`. The private key exists only as the `VAPID_PRIVATE_KEY` GitHub secret, with a backup in the owner's password manager.

> ⚠️ **Never replace the key pair casually.** Every existing sign-up stops working and everyone would have to sign up again.

---

## Running it locally

**Requirements:** Node.js 20 or newer (CI uses 22).

```bash
npm install
cp env.example .env     # then fill in the Contentful values
npm run dev             # http://localhost:4321
```

### What doesn't run in `npm run dev`

- **The service worker** (offline mode, update prompt, notifications) is turned off in dev. To test the app behavior, build and preview:

  ```bash
  npm run build && npm run preview
  ```

  Test offline behavior by stopping the preview server. Chrome DevTools' "Offline" checkbox doesn't apply to the service worker's own requests.

- **Cloudflare Pages Functions** (`functions/`) aren't served by Astro, so the notification sign-up API and the Contentful webhook only work when deployed. For the contact form, `src/pages/api/contact.ts` stands in during development.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build to `dist/` (also builds `sw.js` and `manifest.webmanifest`) |
| `npm run preview` | Serve the production build locally |
| `npm run type-check` | `astro check` (some older files still have type errors; the build doesn't depend on it) |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run icons` | Regenerate app icons from `public/icon.svg` |

---

## Configuration

### Cloudflare Pages (project `howhespeakstous`)

- **Build command:** `npm run build`
- **Output directory:** `dist`

| Setting | Type | Used by |
| --- | --- | --- |
| `CONTENTFUL_SPACE_ID` | Environment variable | Build |
| `CONTENTFUL_DELIVERY_TOKEN` | Environment variable (secret) | Build (read-only Contentful token) |
| `CONTENTFUL_ENVIRONMENT` | Environment variable | Build (defaults to `master`) |
| `RESEND_API_KEY` | Environment variable (secret) | `functions/api/contact.js`, which sends contact form emails via [Resend](https://resend.com) |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | Environment variable (secret) | `functions/api/contentful-webhook.js` |
| `CONTENTFUL_WEBHOOK_SECRET` | Environment variable (optional) | Verifies the Contentful webhook signature, if set |
| `PUSH_SUBSCRIPTIONS` | **KV namespace binding** | `functions/api/push/[action].js` |

### GitHub Actions secrets

| Secret | Used by |
| --- | --- |
| `CLOUDFLARE_DEPLOY_HOOK_URL` | Daily rebuild |
| `VAPID_PRIVATE_KEY` | Daily verse notification |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_NAMESPACE_ID`, `CLOUDFLARE_API_TOKEN` | Daily verse notification (reading and cleaning up sign-ups; the token needs **Workers KV Storage: Edit**) |
| `CONTENTFUL_SPACE_ID`, `CONTENTFUL_DELIVERY_TOKEN` | Daily verse notification (looking up today's verse) |

Set each secret on its own, for example:

```bash
grep '^CONTENTFUL_SPACE_ID=' .env | cut -d= -f2- | gh secret set CONTENTFUL_SPACE_ID
```

Never paste several `gh secret set` commands on one line.

### Contentful

- A webhook on publish points to `https://howgodspeakstous.com/api/contentful-webhook`. See [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md).
- Cloudflare's bot protection must let Contentful's webhook through. See [CLOUDFLARE_FIREWALL_SETUP.md](CLOUDFLARE_FIREWALL_SETUP.md).

---

## Common tasks

**Publish a new verse, post or resource.** Publish it in Contentful. The site rebuilds automatically within a few minutes. Verses can be dated ahead; each one appears on its day.

**Send a test notification.** GitHub → **Actions** → **Daily verse notification** → **Run workflow**, with **force** checked. This sends today's verse to everyone signed up, so only do it while the only sign-ups are your own. Tick **dry run** to check everything without sending. A forced run doesn't count as the morning send.

**Change the notification time.** Edit `SEND_FROM_HOUR` and `SEND_UNTIL_HOUR` in `scripts/send-daily-push.mjs`, and the two `cron` lines in `.github/workflows/daily-verse-push.yml` (in UTC: one for CDT, one for CST). Also update the "7am Central" wording in `PushSignup.astro`, `install.astro` and `about.astro`.

**If the homepage verse didn't change today:** Check GitHub → **Actions** → **Daily rebuild**. GitHub **pauses scheduled workflows after 60 days without repository activity**; re-enable it from that page.

**If notifications didn't arrive:** Open the latest **Daily verse notification** run. The last line reads `Sent: N. Removed expired: N. Failed: N.`

- "Missing required environment variable" means a GitHub secret is missing or empty.
- "No daily verse for …" means no verse is dated today in Contentful.

**Update the privacy page.** Edit `src/pages/privacy.astro` and change its `lastUpdated` date. Do this whenever the site starts collecting or sharing anything new.

---

## Project structure

```
.github/workflows/      daily-rebuild.yml, daily-verse-push.yml
functions/api/          Cloudflare Pages Functions: contact.js, contentful-webhook.js, push/[action].js
scripts/                send-daily-push.mjs
public/                 icons, robots.txt, js/ (tag filtering + pagination for list pages)
src/
  components/           Nav, Seo, PwaHead, UpdateToast, InstallPrompt, PushSignup
  config/               seo.ts, push.mjs
  layouts/Base.astro    shared <head>, navbar, footer
  lib/                  contentful.ts (API client), content-catalog.ts (per-build cache),
                        dates.ts (Chicago "today"), rich-text-renderer.ts, seo.ts
  pages/                routes (see "What readers can do")
  styles/global.css     Tailwind + safe-area and installed-app rules
  sw.ts                 service worker: caching, offline page, notifications
docs/                   development plans for the PWA and notifications
```

**Tech:** Astro 4 · TypeScript · Tailwind CSS · Contentful · Cloudflare Pages + Pages Functions + Workers KV · Workbox · Web Push (`web-push`) · Resend · GitHub Actions

---

## License

[MIT](LICENSE). Built by [DJM-Tech](https://djm-tech.dev/).
