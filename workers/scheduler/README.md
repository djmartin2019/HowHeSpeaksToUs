# Scheduler Worker

A small Cloudflare Worker that starts the site's daily jobs on time. GitHub's
own scheduled workflows can start hours late; Cloudflare cron triggers don't.

| Time (UTC) | Chicago time | What it does |
| --- | --- | --- |
| 06:10 | 12:10am CST / 1:10am CDT | Calls the Cloudflare Pages deploy hook, so the homepage shows the new day's verse |
| 12:00 | 7am CDT | Starts the **Daily verse notification** GitHub workflow |
| 13:00 | 7am CST | Same; the script sends only once per day, so one of these two does nothing |

It has no public URL and stores nothing. The GitHub workflows keep their own
schedules as a backup.

## One-time setup

Run these from this folder (`workers/scheduler`).

### 1. Get a deploy hook URL

Cloudflare dashboard → **Workers & Pages** → **howhespeakstous** → **Settings** →
**Builds** → **Deploy hooks** → **Add deploy hook** (name it `scheduler`, branch `main`).
Copy the URL. Treat it like a password.

### 2. Create a GitHub token

GitHub → your picture → **Settings** → **Developer settings** →
**Personal access tokens** → **Fine-grained tokens** → **Generate new token**:

- **Repository access:** Only select repositories → `HowHeSpeaksToUs`
- **Permissions:** Repository permissions → **Actions: Read and write** (nothing else)
- **Expiration:** the longest offered. Put a reminder in your calendar to renew it.

Copy the token (it starts with `github_pat_`).

### 3. Deploy and add the secrets

```bash
npx wrangler@4 login          # opens the browser once
npx wrangler@4 deploy
npx wrangler@4 secret put DEPLOY_HOOK_URL   # paste the URL from step 1
npx wrangler@4 secret put GITHUB_TOKEN      # paste the token from step 2
```

Each `secret put` asks for the value; nothing is saved in the repo.

## Checking that it works

- **Notifications:** GitHub → **Actions** → **Daily verse notification**. Runs
  started by the Worker are labelled `workflow_dispatch` and start at about
  12:00 and 13:00 UTC.
- **Rebuild:** Cloudflare → **howhespeakstous** → **Deployments** shows a
  deploy hook build at about 06:10 UTC.
- **Errors:** Cloudflare → **Workers & Pages** → **howgodspeakstous-scheduler** →
  **Logs**. "GitHub returned HTTP 401" means the token expired or was revoked;
  make a new one (step 2) and run `secret put GITHUB_TOKEN` again.

## Changing the times

Edit the `crons` list in `wrangler.toml` **and** the matching strings at the top
of `src/index.js`, then run `npx wrangler@4 deploy`.

## Testing locally

```bash
printf 'DEPLOY_HOOK_URL=http://127.0.0.1:9/\nGITHUB_TOKEN=fake\n' > .dev.vars
npx wrangler@4 dev --test-scheduled
curl 'localhost:8787/__scheduled?cron=0+12+*+*+*'
```

With a fake token, GitHub answers 401, which shows the request was sent.
Delete `.dev.vars` afterwards (it's git-ignored).
