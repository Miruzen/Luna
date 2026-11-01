// Regression tests for existing V0.1 behaviour (Stage 1: existing functionality must stay intact).
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { annotateExplicitDates, annotateRelativeDays, formatAllDay, formatRange, localDate, localNow, midnightIso, relativeDateTable } from "./time.ts";

Deno.test("localNow: rolls over to the next local day in WIB", () => {
  assertEquals(localNow("Asia/Jakarta", new Date("2026-09-29T18:30:00Z")), "2026-09-30T01:30:00+07:00 (Wednesday)");
});

Deno.test("localNow: negative offsets", () => {
  assertEquals(localNow("America/New_York", new Date("2026-09-29T18:30:00Z")), "2026-09-29T14:30:00-04:00 (Tuesday)");
});

Deno.test("formatRange: same-day range", () => {
  assertEquals(
    formatRange("2026-09-30T09:00:00+07:00", "2026-09-30T10:00:00+07:00", "Asia/Jakarta"),
    "Wed, 30 Sept 2026, 09:00–10:00",
  );
});

Deno.test("relativeDateTable: besok/lusa/next week from Thursday 15 Oct (WIB)", () => {
  const t = relativeDateTable("Asia/Jakarta", new Date("2026-10-15T03:00:00Z"));
  assertStringIncludes(t, "hari ini / today: Kamis (Thursday) 2026-10-15");
  assertStringIncludes(t, "besok / tomorrow: Jumat (Friday) 2026-10-16");
  assertStringIncludes(t, "lusa / besok lusa / the day after tomorrow: Sabtu (Saturday) 2026-10-17");
  assertStringIncludes(t, "next week starts: Senin (Monday) 2026-10-19");
});

Deno.test("relativeDateTable: uses the local date (18:30Z is already the next day in WIB)", () => {
  const t = relativeDateTable("Asia/Jakarta", new Date("2026-10-14T18:30:00Z"));
  assertStringIncludes(t, "hari ini / today: Kamis (Thursday) 2026-10-15");
});

Deno.test("relativeDateTable: crosses month boundaries; on Monday next week is +7", () => {
  const t = relativeDateTable("Asia/Jakarta", new Date("2026-11-30T03:00:00Z")); // Monday
  assertStringIncludes(t, "besok / tomorrow: Selasa (Tuesday) 2026-12-01");
  assertStringIncludes(t, "next week starts: Senin (Monday) 2026-12-07");
});

Deno.test("annotateRelativeDays: adds exact dates, longest phrase first, words kept", () => {
  const now = new Date("2026-10-15T03:00:00Z"); // Thursday 15 Oct, WIB
  assertEquals(annotateRelativeDays("lusa jam 9 pagi", "Asia/Jakarta", now), "lusa (Sabtu 2026-10-17) jam 9 pagi");
  assertEquals(annotateRelativeDays("besok lusa jam 2", "Asia/Jakarta", now), "besok lusa (Sabtu 2026-10-17) jam 2");
  assertEquals(annotateRelativeDays("Besok jam 3 sore", "Asia/Jakarta", now), "Besok (Jumat 2026-10-16) jam 3 sore");
  assertEquals(annotateRelativeDays("nanti malam jam 8", "Asia/Jakarta", now), "nanti malam (Kamis 2026-10-15) jam 8");
  assertEquals(annotateRelativeDays("senin depan jam 9", "Asia/Jakarta", now), "senin depan jam 9"); // untouched
});

// OI-7 (Stage 3.1 T4): explicit dates get their weekday and "sudah lewat" from code.
const THU_15_OCT = new Date("2026-10-15T03:00:00Z"); // Thursday 15 Oct 2026, 10:00 WIB

Deno.test("annotateExplicitDates: the OI-7 sentence (past date, wrong weekday, curly apostrophe)", () => {
  assertEquals(
    annotateExplicitDates("jadwal meeting hari minggu 1’ oktober jam 3 sore", "Asia/Jakarta", THU_15_OCT),
    "jadwal meeting hari minggu 1’ oktober (Kamis 2026-10-01, sudah lewat; tahun depan: Jumat 2027-10-01) jam 3 sore",
  );
});

Deno.test("annotateExplicitDates: future date, abbreviated month, 'tanggal' prefix", () => {
  assertEquals(
    annotateExplicitDates("tanggal 3 nov jam 10 seminar", "Asia/Jakarta", THU_15_OCT),
    "tanggal 3 nov (Selasa 2026-11-03) jam 10 seminar",
  );
});

Deno.test("annotateExplicitDates: today counts as not passed; explicit year is respected", () => {
  assertEquals(annotateExplicitDates("15 oktober", "Asia/Jakarta", THU_15_OCT), "15 oktober (Kamis 2026-10-15)");
  assertEquals(annotateExplicitDates("1 januari 2027", "Asia/Jakarta", THU_15_OCT), "1 januari 2027 (Jumat 2027-01-01)");
  assertEquals(annotateExplicitDates("1 maret 2026", "Asia/Jakarta", THU_15_OCT), "1 maret 2026 (Minggu 2026-03-01, sudah lewat)");
});

Deno.test("annotateExplicitDates: leaves times, impossible dates and plain numbers alone", () => {
  for (const s of ["jam 3 sore meeting 1 jam", "31 februari", "meeting 2 jam", "setengah 3"]) {
    assertEquals(annotateExplicitDates(s, "Asia/Jakarta", THU_15_OCT), s);
  }
});

Deno.test("annotateExplicitDates + annotateRelativeDays compose", () => {
  const out = annotateRelativeDays(annotateExplicitDates("besok atau 3 november", "Asia/Jakarta", THU_15_OCT), "Asia/Jakarta", THU_15_OCT);
  assertEquals(out, "besok (Jumat 2026-10-16) atau 3 november (Selasa 2026-11-03)");
});

Deno.test("annotateExplicitDates: relative years (F3.1-9: '27 Februari 5 tahun kedepan')", () => {
  const tz = "Asia/Jakarta";
  assertEquals(annotateExplicitDates("tanggal 27 Februari 5 tahun kedepan", tz, THU_15_OCT), "tanggal 27 Februari 5 tahun kedepan (Kamis 2031-02-27)");
  assertEquals(annotateExplicitDates("1 mei tahun depan", tz, THU_15_OCT), "1 mei tahun depan (Sabtu 2027-05-01)");
  assertEquals(annotateExplicitDates("3 maret dua tahun lagi", tz, THU_15_OCT), "3 maret dua tahun lagi (Jumat 2028-03-03)");
  assertEquals(annotateExplicitDates("1 maret 5 tahun ke depan", tz, THU_15_OCT), "1 maret 5 tahun ke depan (Sabtu 2031-03-01)");
});

Deno.test("all-day helpers: localDate, midnightIso, formatAllDay", () => {
  assertEquals(localDate("2031-02-26T17:00:00Z", "Asia/Jakarta"), "2031-02-27");
  assertEquals(midnightIso("2031-02-27", "Asia/Jakarta"), "2031-02-27T00:00:00+07:00");
  assertEquals(midnightIso("2026-07-01", "America/New_York"), "2026-07-01T00:00:00-04:00");
  assertEquals(formatAllDay("2031-02-27T00:00:00+07:00", "2031-02-28T00:00:00+07:00", "Asia/Jakarta"), "Thu, 27 Feb 2031 (all day)");
  assertEquals(
    formatAllDay("2031-03-01T00:00:00+07:00", "2031-03-04T00:00:00+07:00", "Asia/Jakarta"),
    "Sat, 1 Mar 2031 – Mon, 3 Mar 2031 (all day)",
  );
});
