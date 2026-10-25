# Task: Turn howgodspeakstous.com into an installable PWA

You are in plan mode. Do not write code yet. First read the codebase, verify that what is described below can be implemented as written, and come back with a concrete plan, a list of files you will touch, and any questions or conflicts you found.

## Context

- This is a devotional blog for my dad's Bible studies: https://howgodspeakstous.com
- Built with Astro. Content (blog posts, daily verses with commentary, sermon resource PDFs) comes from Contentful. Images are served from `images.ctfassets.net` and PDFs from `assets.ctfassets.net`.
- Main routes: `/`, `/blog`, `/blog/[slug]`, `/daily-verses`, `/daily-verses/[YYYY-MM-DD]`, `/resources`, `/resources/[slug]`, `/about`, `/contact`.
- The homepage shows a "Verse of the Day" that changes daily.
- The `<head>` already has `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, and `theme-color` meta tags. I do not believe there is a web manifest or service worker yet. Confirm this.
- The audience is mostly older, non-technical church members on phones. Installing the app and having it "just work" matters more than clever features.

## Goal

People can install the site to their phone home screen, it opens like an app, it loads fast, it works reasonably offline, and it never shows stale "today" content.

## Phase 1: Investigate before planning

Read the code and report back on each of these. Several decisions below depend on the answers.

1. Astro version and `output` mode (`static`, `server`, or `hybrid`), plus the adapter and hosting platform (Vercel, Netlify, Cloudflare, etc.).
2. How the Verse of the Day is produced. Is it fetched at build time with a scheduled rebuild, rendered on request, or fetched client-side? This decides the caching strategy for `/` and `/daily-verses/*`.
3. How Contentful is queried (build-time only, or any client-side calls). Confirm no Contentful access tokens are exposed to the browser, and that the service worker will never cache an authenticated API response.
4. Whether any service worker, manifest, or PWA plugin already exists, including leftovers in `public/`.
5. The existing icons and favicon assets in `public/`, and what source image we have to generate PWA icons from.
6. The shared layout or head component where the manifest link and SW registration should live.
7. Roughly how many pages the build produces, so we can decide what to precache.
8. Any existing analytics, third-party scripts, or embeds that the service worker should leave alone.

## Phase 2: Requirements

### Manifest

- Use `@vite-pwa/astro` (Workbox under the hood) unless you find a strong reason not to. If you recommend something else, explain why.
- `name`: "How God Speaks To Us", `short_name`: something that fits under a home screen icon (propose options, around 12 characters max).
- `start_url: "/"`, `scope: "/"`, `display: "standalone"`.
- `theme_color` and `background_color` consistent with the site's existing theme and the current `theme-color` meta tag. The site declares `color-scheme: light dark`, so check how that should interact with the splash screen.
- Icons: 192x192, 512x512, and a separate 512x512 maskable icon with safe-zone padding. Also an `apple-touch-icon` (180x180), since iOS ignores manifest icons. If generation tooling is needed, suggest `@vite-pwa/assets-generator`.
- Include a `description` and add `screenshots` only if it is simple to do. They improve the Android install UI.

### Caching strategy (per route type)

This is the most important part. Get it right rather than fast.

| Content | Strategy | Notes |
|---|---|---|
| App shell: JS, CSS, fonts, icons | Precache | Hashed build assets |
| `/` and `/daily-verses/*` | NetworkFirst with a short timeout (~3s), cache fallback | Must never show yesterday's verse when online |
| `/blog/*`, `/resources/*`, other pages | StaleWhileRevalidate | |
| `images.ctfassets.net` | CacheFirst with expiration (cap entries, e.g. 60 images, 30 days) | Handle opaque responses correctly or set CORS properly |
| `assets.ctfassets.net` PDFs | Do not precache. Either NetworkOnly, or CacheFirst only after the user opens one, with a small cap | PDFs are large. Recommend which approach and why |
| Anything else cross-origin (analytics, Productboard link, etc.) | Not handled by the SW | |

- Do not precache every HTML page. Precache the shell plus the offline page; let other pages be cached as they are visited.
- If the verse is baked in at build time, call out that the cached HTML is still only as fresh as the last deploy, and confirm that the scheduled rebuild exists.

### Offline experience

- A branded `/offline` page used as the navigation fallback when a page is not in cache and the network fails.
- Ideally it lists pages the user has already visited and that are available offline. If this adds real complexity, propose it as a follow-up instead.

### Update behavior

- When a new service worker is available, show a small, non-intrusive "New content available. Refresh" toast instead of silently swapping under the user. Explain the trade-off between `registerType: 'prompt'` and `'autoUpdate'` for this audience, and recommend one.
- Ensure old caches are cleaned up on activate.

### Install experience

- Android/Chrome: capture `beforeinstallprompt` and show a tasteful "Install app" button (e.g., in the footer or a dismissible banner). Do not nag. Remember dismissal in `localStorage` with try/catch.
- iOS Safari has no install prompt. Detect iOS Safari that is not already in standalone mode and show a short instruction ("Tap Share, then Add to Home Screen") with a simple illustration or icon.
- Add an `/install` page with step-by-step instructions for iPhone and Android, written for non-technical readers. Link to it from the footer.
- Hide all install UI when already running in standalone mode.

### Accessibility and design

- All new UI (toast, install banner, offline page, install page) must match the existing site styles, work in light and dark mode, be keyboard and screen-reader accessible, and respect `prefers-reduced-motion`.
- Check that `viewport-fit=cover` plus standalone mode does not put content under the iPhone notch or home indicator. Use `env(safe-area-inset-*)` where needed.

## Out of scope (do not build, but do not block)

- Push notifications for the daily verse. Do not implement them, but do not make choices that would prevent adding them later.
- Any backend, database, or Databricks work.
- Redesigning existing pages.

## Phase 3: Verification plan

Include in your plan how we will verify:

1. `astro build` succeeds and the generated `manifest.webmanifest` and `sw.js` look correct.
2. Lighthouse PWA/installability checks pass (or the Chrome DevTools Application panel shows no manifest errors), run against a production build preview, not the dev server.
3. Offline test in DevTools: visited pages load offline, unvisited pages show `/offline`.
4. Freshness test: after a new deploy with a different verse, the homepage shows the new verse on the next online load.
5. Update test: deploying a new build triggers the refresh toast.
6. Manual checklist for real devices: install on an iPhone (Safari) and an Android phone (Chrome), check icon, splash, status bar, safe areas, and offline behavior.

## What I want back from plan mode

1. Findings from Phase 1, especially anything that contradicts my assumptions.
2. The implementation plan, step by step, with the files you will create or modify.
3. Your recommendations on the open decisions: `prompt` vs `autoUpdate`, PDF caching, `short_name`, and whether the "available offline" list on the offline page is worth doing now.
4. Risks and anything you think I have missed.

Keep the changes small and reviewable. Prefer configuration over custom service worker code unless custom code is genuinely needed, and explain any non-obvious Workbox behavior in comments.
