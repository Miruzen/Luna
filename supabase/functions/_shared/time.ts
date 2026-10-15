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

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Pre-computed calendar facts for the LLM prompt, so a small model only has to look dates up
// instead of calculating them ("lusa" = +2 days, "Senin depan", ...). Computed by code: always
// correct for the user's timezone. OI-3, docs/OPEN_ITEMS.md.
export function relativeDateTable(tz: string, now = new Date(), days = 14): string {
  const p = partsIn(now, tz);
  // Local calendar date of "today" in tz, anchored at UTC noon so adding days never shifts the date.
  const base = Date.UTC(+p.year, +p.month - 1, +p.day, 12);
  const day = (offset: number) => {
    const d = new Date(base + offset * 86_400_000);
    return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
  };
  const label = (offset: number) => {
    const d = day(offset);
    return `${HARI[d.dow]} (${DAY_EN[d.dow]}) ${d.iso}`;
  };
  const todayDow = day(0).dow;
  const nextMondayOffset = ((8 - todayDow) % 7) || 7;
  const upcoming = Array.from({ length: days }, (_, i) => label(i + 1)).join("; ");
  return [
    "Calendar reference (computed by LUNA; use these dates, do not recalculate):",
    `- hari ini / today: ${label(0)}`,
    `- besok / tomorrow: ${label(1)}`,
    `- lusa / besok lusa / the day after tomorrow: ${label(2)}`,
    `- minggu depan / next week starts: ${label(nextMondayOffset)}`,
    `- next ${days} days: ${upcoming}`,
    `A weekday name alone (e.g. "Senin") means its first occurrence in the list above; "<weekday> minggu depan" means that weekday in the week starting ${day(nextMondayOffset).iso}.`,
    `Indonesian time words: "setengah N" = (N-1):30 (setengah 3 = 2:30); pagi ≈ 05-11, siang ≈ 11-15, sore ≈ 15-18, malam ≈ 18-24 (so "jam 8 malam" = 20:00).`,
  ].join("\n");
}

// Annotates Indonesian relative-day words in the user's text with the exact local date, e.g.
// "lusa jam 9" -> "lusa (Sabtu 2026-10-17) jam 9". The words stay; the date is added by code, so a
// small model cannot miscount (it ignored the reference table for "lusa" in the OI-3 eval).
// Idea from Nanda (2026-10-15): LUNA knows the exact date, so LUNA should state it.
const RELATIVE_DAYS: Record<string, number> = {
  "besok lusa": 2, "lusa": 2, "besok": 1, "hari ini": 0, "nanti malam": 0, "malam ini": 0,
};
export function annotateRelativeDays(text: string, tz: string, now = new Date()): string {
  const p = partsIn(now, tz);
  const base = Date.UTC(+p.year, +p.month - 1, +p.day, 12);
  // Longest phrases first so "besok lusa" wins over "besok"; word boundaries avoid partial words.
  return text.replace(/\b(besok lusa|lusa|besok|hari ini|nanti malam|malam ini)\b/gi, (match) => {
    const d = new Date(base + RELATIVE_DAYS[match.toLowerCase()] * 86_400_000);
    return `${match} (${HARI[d.getUTCDay()]} ${d.toISOString().slice(0, 10)})`;
  });
}
