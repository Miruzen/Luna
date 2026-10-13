// Regression tests for existing V0.1 behaviour (Stage 1: existing functionality must stay intact).
import { assertEquals } from "jsr:@std/assert@1";
import { formatRange, localNow } from "./time.ts";

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
