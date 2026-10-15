// Regression tests for existing V0.1 behaviour (Stage 1: existing functionality must stay intact).
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { annotateRelativeDays, formatRange, localNow, relativeDateTable } from "./time.ts";

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
