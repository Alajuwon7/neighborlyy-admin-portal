// Helpers for the event forms. <input type="date"> and <input type="time">
// work in the browser's local time, but events.event_date is a timestamptz,
// so we convert in the browser where the PM's timezone is known.

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO timestamp -> "YYYY-MM-DD" in local time, for a date input. */
export function toLocalDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** ISO timestamp -> "HH:mm" in local time, for a time input. */
export function toLocalTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local date + time inputs -> ISO timestamp, or null if invalid. */
export function localInputsToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
