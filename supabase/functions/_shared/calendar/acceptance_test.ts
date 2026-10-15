import { assertEquals } from "jsr:@std/assert@1";
import { checkCalendarOutcome } from "./acceptance.ts";

const approved = {
  title: "TEST LUNA",
  start_datetime: "2026-10-16T16:00:00+07:00",
  end_datetime: "2026-10-16T16:15:00+07:00",
  timezone: "Asia/Jakarta",
};

Deno.test("acceptance: matching event passes, even in another ISO format/offset", () => {
  assertEquals(checkCalendarOutcome(approved, { summary: "TEST LUNA", start: "2026-10-16T09:00:00Z", end: "2026-10-16T16:15:00+07:00" }), []);
});

Deno.test("acceptance: wrong time is reported", () => {
  assertEquals(checkCalendarOutcome(approved, { summary: "TEST LUNA", start: "2026-10-16T23:00:00+07:00", end: "2026-10-16T16:15:00+07:00" }), [
    "start: approved 2026-10-16T16:00:00+07:00, got 2026-10-16T23:00:00+07:00",
  ]);
});

Deno.test("acceptance: wrong title and missing times are reported", () => {
  assertEquals(checkCalendarOutcome(approved, { summary: "HACKED" }), [
    'title: approved "TEST LUNA", got "HACKED"',
    "start: missing in created event",
    "end: missing in created event",
  ]);
});
