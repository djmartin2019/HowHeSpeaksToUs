/**
 * The site's "today", as YYYY-MM-DD, in the audience's timezone.
 *
 * Pages are built ahead of time, so "today" is decided when the build runs.
 * Using UTC would flip to tomorrow's verse around 7pm US Central, so we use
 * the site's local timezone instead. A daily rebuild just after local midnight
 * (.github/workflows/daily-rebuild.yml) keeps the homepage current.
 */
export const SITE_TIME_ZONE = "America/Chicago";

export function todayInSiteTz(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
