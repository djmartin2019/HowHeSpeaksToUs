#!/usr/bin/env node
/**
 * Sends today's verse as a push notification to everyone who signed up.
 * Run each morning by .github/workflows/daily-verse-push.yml.
 *
 * GitHub's schedule is in UTC and Chicago changes clocks twice a year, so the
 * workflow runs at both 12:00 and 13:00 UTC. This script only sends when it's
 * between 7 and 11am in Chicago and it hasn't already sent today, so exactly one
 * of those runs sends, even if GitHub starts it late.
 *
 * Environment variables:
 *   VAPID_PRIVATE_KEY                         required
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN   required
 *   CONTENTFUL_SPACE_ID, CONTENTFUL_DELIVERY_TOKEN                          required
 *   CONTENTFUL_ENVIRONMENT   optional, defaults to "master"
 *   FORCE=true     send now, ignoring the time window and the "already sent" check
 *                  (and don't record it, so the real morning send still happens)
 *   DRY_RUN=true   do everything except send or change anything
 */
import webpush from "web-push";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "../src/config/push.mjs";

const TIME_ZONE = "America/Chicago"; // keep in sync with src/lib/dates.ts
const SEND_FROM_HOUR = 7;
const SEND_UNTIL_HOUR = 11; // don't send a "morning" verse after this
const LAST_SENT_KEY = "meta:last-sent";
const SUBSCRIPTION_PREFIX = "sub:";
const BODY_MAX_CHARS = 140;
// If a phone is off, the push service holds the notification this long, then drops it.
const TTL_SECONDS = 4 * 60 * 60;
const CONCURRENCY = 10;

const env = process.env;
const FORCE = env.FORCE === "true";
const DRY_RUN = env.DRY_RUN === "true";

function requireEnv(name) {
  const value = env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

function chicagoNow(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

// ---------------------------------------------------------------------------
// Cloudflare KV (REST API)
// ---------------------------------------------------------------------------

function kvClient() {
  const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const namespace = requireEnv("CLOUDFLARE_KV_NAMESPACE_ID");
  const token = requireEnv("CLOUDFLARE_API_TOKEN");
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}`;
  const headers = { Authorization: `Bearer ${token}` };

  async function call(path, init = {}) {
    const res = await fetch(base + path, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cloudflare KV ${init.method || "GET"} failed: HTTP ${res.status} ${await res.text()}`);
    }
    return res;
  }

  return {
    async get(key) {
      const res = await call(`/values/${encodeURIComponent(key)}`);
      return res.status === 404 ? null : res.text();
    },
    async put(key, value) {
      await call(`/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "text/plain" },
        body: value,
      });
    },
    async delete(key) {
      await call(`/values/${encodeURIComponent(key)}`, { method: "DELETE" });
    },
    // Each list call returns up to 1000 keys, with their metadata.
    async list(prefix) {
      const keys = [];
      let cursor = "";
      do {
        const params = new URLSearchParams({ prefix, limit: "1000" });
        if (cursor) params.set("cursor", cursor);
        const data = await (await call(`/keys?${params}`)).json();
        keys.push(...data.result);
        cursor = data.result_info?.cursor || "";
      } while (cursor);
      return keys;
    },
  };
}

// ---------------------------------------------------------------------------
// Contentful (same query as getDailyVerseByDate in src/lib/contentful.ts)
// ---------------------------------------------------------------------------

async function getVerseForDate(date) {
  const space = requireEnv("CONTENTFUL_SPACE_ID");
  const token = requireEnv("CONTENTFUL_DELIVERY_TOKEN");
  const environment = env.CONTENTFUL_ENVIRONMENT || "master";
  const params = new URLSearchParams({
    content_type: "dailyVerse",
    "fields.date[gte]": `${date}T00:00:00Z`,
    "fields.date[lte]": `${date}T23:59:59Z`,
    limit: "1",
    locale: "en-US",
  });
  const res = await fetch(
    `https://cdn.contentful.com/spaces/${space}/environments/${environment}/entries?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Contentful request failed: HTTP ${res.status}`);
  const data = await res.json();
  return data.items?.[0]?.fields ?? null;
}

// Flattens Contentful rich text to plain text.
function richTextToPlain(node) {
  if (!node) return "";
  if (node.nodeType === "text") return node.value || "";
  const parts = (node.content || []).map(richTextToPlain);
  return node.nodeType === "document" ? parts.join(" ") : parts.join("");
}

function truncate(text, max) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).replace(/[\s,;:.]+$/, "") + "…";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { date, hour } = chicagoNow();
  const kv = kvClient();
  console.log(`Chicago time: ${date}, hour ${hour}.${FORCE ? " FORCE" : ""}${DRY_RUN ? " DRY RUN" : ""}`);

  if (!FORCE) {
    if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) {
      console.log(`Outside the ${SEND_FROM_HOUR}-${SEND_UNTIL_HOUR}am window. Nothing to do.`);
      return;
    }
    if ((await kv.get(LAST_SENT_KEY)) === date) {
      console.log("Already sent today. Nothing to do.");
      return;
    }
  }

  const verse = await getVerseForDate(date);
  if (!verse) {
    console.log(`No daily verse for ${date}. Nothing sent.`);
    return;
  }

  const reference = (verse.passage || "").trim();
  const text = richTextToPlain(verse.verse);
  const body = truncate(reference ? `${reference}: ${text}` : text, BODY_MAX_CHARS) || "Today's verse is ready.";
  const payload = JSON.stringify({ title: "Today's Verse", body, url: `/daily-verses/${date}` });
  console.log(`Notification: "${body}"`);

  const keys = await kv.list(SUBSCRIPTION_PREFIX);
  console.log(`Sign-ups: ${keys.length}`);

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, requireEnv("VAPID_PRIVATE_KEY"));

  let sent = 0;
  let removed = 0;
  let failed = 0;

  async function sendTo({ name, metadata }) {
    // The subscription is normally in the key's metadata (see
    // functions/api/push/[action].js); read the value only if it isn't.
    let subscription = metadata?.endpoint ? metadata : null;
    if (!subscription) {
      const raw = await kv.get(name);
      subscription = raw ? JSON.parse(raw) : null;
    }
    if (!subscription?.endpoint) {
      if (!DRY_RUN) await kv.delete(name);
      removed++;
      return;
    }
    if (DRY_RUN) {
      sent++;
      return;
    }
    try {
      await webpush.sendNotification(subscription, payload, {
        TTL: TTL_SECONDS,
        urgency: "normal",
        // A newer notification with the same topic replaces an undelivered older one.
        topic: "daily-verse",
      });
      sent++;
    } catch (error) {
      // 404/410: the person turned notifications off or removed the app.
      if (error.statusCode === 404 || error.statusCode === 410) {
        await kv.delete(name);
        removed++;
      } else {
        failed++;
        console.warn(`Send failed: HTTP ${error.statusCode ?? "?"} ${String(error.body || error.message).slice(0, 200)}`);
      }
    }
  }

  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(keys.slice(i, i + CONCURRENCY).map(sendTo));
  }

  // Record the send so the second scheduled run doesn't send again. Forced
  // (test) runs don't count, so they never block the real morning send.
  if (!FORCE && !DRY_RUN) await kv.put(LAST_SENT_KEY, date);

  console.log(`Done. Sent: ${sent}. Removed expired: ${removed}. Failed: ${failed}.`);
  if (failed > 0 && sent === 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
