// Cloudflare Pages Function: daily verse notification sign-ups.
//
//   POST /api/push/subscribe    body: the browser's PushSubscription (JSON)
//   POST /api/push/unsubscribe  body: { "endpoint": "..." }
//
// Sign-ups are stored in the PUSH_SUBSCRIPTIONS KV namespace (bound to this
// Pages project in the Cloudflare dashboard). Only the push address and its
// encryption keys are stored: no names, emails or other personal details.
// The morning send script (scripts/send-daily-push.mjs) reads them back.

// Push services run by Google (Chrome/Android), Mozilla (Firefox),
// Apple (Safari/iPhone) and Microsoft (Edge). Anything else is rejected.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];
const MAX_BODY_BYTES = 4096;
// KV metadata is limited to 1024 bytes. Storing the subscription there lets the
// send script get every sign-up from a single "list" call instead of reading
// each one separately (which matters for the free plan's daily limits).
const MAX_METADATA_BYTES = 1024;
const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

export async function onRequestPost({ request, env, params }) {
  const action = params.action;
  if (action !== "subscribe" && action !== "unsubscribe") {
    return json({ ok: false, error: "Not found" }, 404);
  }

  const kv = env.PUSH_SUBSCRIPTIONS;
  if (!kv) {
    console.error("PUSH_SUBSCRIPTIONS KV binding is not configured");
    return json({ ok: false, error: "Notifications are not set up yet" }, 503);
  }

  // Only accept requests from this site's own pages.
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, error: "Forbidden" }, 403);
  }
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) {
    return json({ ok: false, error: "Expected JSON" }, 415);
  }
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
    return json({ ok: false, error: "Too large" }, 413);
  }

  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json({ ok: false, error: "Too large" }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!isPushEndpoint(endpoint)) {
    return json({ ok: false, error: "Invalid subscription" }, 400);
  }
  const key = `sub:${await sha256Hex(endpoint)}`;

  if (action === "unsubscribe") {
    await kv.delete(key);
    return json({ ok: true });
  }

  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!isKey(p256dh, 120) || !isKey(auth, 48)) {
    return json({ ok: false, error: "Invalid subscription" }, 400);
  }

  const subscription = { endpoint, keys: { p256dh, auth } };
  const fitsInMetadata = JSON.stringify(subscription).length <= MAX_METADATA_BYTES;
  await kv.put(
    key,
    JSON.stringify({ ...subscription, createdAt: new Date().toISOString() }),
    fitsInMetadata ? { metadata: subscription } : undefined,
  );
  return json({ ok: true });
}

function isPushEndpoint(value) {
  if (!value || value.length > 1024) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function isKey(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength && BASE64URL.test(value);
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
