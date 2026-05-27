/**
 * Local calendar-date helpers, shared by the server vault writer and the
 * client UI. Pure (no Node or browser APIs) so it is safe to import anywhere.
 */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local date as YYYY-MM-DD, so "daily" tracks the user's day, not UTC. */
export function localDateStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local wall-clock time as HH:MM:SS. */
export function localTimeStamp(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
