function partsIn(date: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "long",
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

// "2026-09-29T14:03:00+07:00 (Tuesday)" — local wall time with offset, so the LLM
// resolves "tomorrow" / "tonight" against the user's day, not UTC.
export function localNow(tz: string, date = new Date()): string {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offMin = Math.round((asUtc - date.getTime()) / 60000);
  const sign = offMin >= 0 ? "+" : "-";
  const abs = Math.abs(offMin);
  const off = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${off} (${p.weekday})`;
}

// "Wed, 30 Sep 2026, 09:00–10:00" in the event's timezone, for the confirm card.
export function formatRange(startIso: string, endIso: string, tz: string): string {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const s = new Date(startIso), e = new Date(endIso);
  const sameDay = day.format(s) === day.format(e);
  return sameDay
    ? `${day.format(s)}, ${time.format(s)}–${time.format(e)}`
    : `${day.format(s)}, ${time.format(s)} – ${day.format(e)}, ${time.format(e)}`;
}
