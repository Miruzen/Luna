// Regression tests for existing V0.1 behaviour (Stage 1: existing functionality must stay intact).
import { assertEquals } from "jsr:@std/assert@1";
import { validateEventArgs } from "./validate.ts";

const valid = {
  title: "Meeting",
  start_datetime: "2026-09-30T09:00:00+07:00",
  end_datetime: "2026-09-30T10:00:00+07:00",
  timezone: "Asia/Jakarta",
};

Deno.test("validate: accepts a valid event", () => {
  const v = validateEventArgs(valid);
  assertEquals(v.ok, true);
});

Deno.test("validate: rejects datetime without UTC offset", () => {
  assertEquals(validateEventArgs({ ...valid, start_datetime: "2026-09-30T09:00:00" }), {
    ok: false,
    errors: ["start_datetime must be ISO 8601 with UTC offset"],
  });
});

Deno.test("validate: rejects end before start and bad attendee", () => {
  assertEquals(validateEventArgs({ ...valid, end_datetime: "2026-09-30T08:00:00+07:00", attendees: ["bob"] }), {
    ok: false,
    errors: ["end must be after start", "attendees must be valid emails"],
  });
});

Deno.test("validate: null input fails without throwing", () => {
  const v = validateEventArgs(null);
  assertEquals(v.ok, false);
});
