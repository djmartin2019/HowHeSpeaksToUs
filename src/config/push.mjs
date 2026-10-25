// Daily verse push notification settings, shared by the browser code,
// the service worker (src/sw.ts) and the morning send script
// (scripts/send-daily-push.mjs).

// Public half of the VAPID key pair. It is safe to publish. The private half is
// the VAPID_PRIVATE_KEY GitHub Actions secret. If the pair is ever replaced,
// every existing sign-up stops working and people must sign up again.
export const VAPID_PUBLIC_KEY =
  "BP1Mpvt9SIZWOt6T5XVJxnIFuufBQ9F-iICUJsCV6uIE7LH4n4Ob_nARlAXVS_hIG6JtypUBw5gPH3fbHLA3oS4";

// Push services use this to contact the site owner about problems.
export const VAPID_SUBJECT = "mailto:howhespeakstous@gmail.com";

export const SUBSCRIBE_URL = "/api/push/subscribe";
export const UNSUBSCRIBE_URL = "/api/push/unsubscribe";

// pushManager.subscribe() needs the key as bytes, not base64url text.
/** @param {string} base64Url */
export function urlBase64ToUint8Array(base64Url) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
