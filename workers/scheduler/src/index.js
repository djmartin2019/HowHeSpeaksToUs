// Keeps the site's daily jobs on time. GitHub's own schedules can start hours
// late; Cloudflare cron triggers fire within a minute or so.
//
// - 06:10 UTC: rebuild the site so the homepage shows the new day's verse.
// - 12:00 and 13:00 UTC: start the "Daily verse notification" GitHub workflow.
//   Two times because Chicago changes clocks; the script itself sends only
//   between 7 and 11am Chicago time and only once per day.
//
// Secrets (set with `npx wrangler secret put <NAME>`):
//   DEPLOY_HOOK_URL  Cloudflare Pages deploy hook URL
//   GITHUB_TOKEN     fine-grained token with "Actions: read and write" on this repo

const REBUILD_CRON = "10 6 * * *";
const PUSH_CRONS = ["0 12 * * *", "0 13 * * *"];

export default {
  async scheduled(event, env) {
    if (event.cron === REBUILD_CRON) {
      await withRetry("rebuild", () => triggerRebuild(env));
    } else if (PUSH_CRONS.includes(event.cron)) {
      await withRetry("push workflow", () => startPushWorkflow(env));
    } else {
      throw new Error(`No job for cron "${event.cron}"`);
    }
  },

  // Nothing to see over HTTP; the Worker only runs on a schedule.
  async fetch() {
    return new Response("Not found", { status: 404 });
  },
};

async function triggerRebuild(env) {
  requireSecret(env, "DEPLOY_HOOK_URL");
  const res = await fetch(env.DEPLOY_HOOK_URL, { method: "POST" });
  if (!res.ok) throw new Error(`Deploy hook returned HTTP ${res.status}`);
  console.log("Rebuild started");
}

async function startPushWorkflow(env) {
  requireSecret(env, "GITHUB_TOKEN");
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${env.PUSH_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "howgodspeakstous-scheduler",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.GITHUB_BRANCH }),
  });
  if (res.status !== 204) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`GitHub returned HTTP ${res.status}: ${detail}`);
  }
  console.log("Push workflow started");
}

function requireSecret(env, name) {
  if (!env[name]) throw new Error(`Secret ${name} is not set`);
}

// One retry after 30 seconds covers brief network or API hiccups.
async function withRetry(label, job) {
  try {
    await job();
  } catch (err) {
    console.warn(`${label} failed, retrying in 30s: ${err.message}`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    await job();
  }
}
