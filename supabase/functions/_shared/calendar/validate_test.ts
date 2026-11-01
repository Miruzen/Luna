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

// All-day events (Stage 3.1, F3.1-8): snapped to whole local days, end exclusive.
const allDay = { title: "Come back", timezone: "Asia/Jakarta", all_day: true };

Deno.test("all-day: a single day given as 00:00-23:59 becomes midnight to next midnight", () => {
  const v = validateEventArgs({ ...allDay, start_datetime: "2031-02-27T00:00:00+07:00", end_datetime: "2031-02-27T23:59:00+07:00" });
  assertEquals(v.ok && [v.args.start_datetime, v.args.end_datetime, v.args.all_day], ["2031-02-27T00:00:00+07:00", "2031-02-28T00:00:00+07:00", true]);
});

Deno.test("all-day: exclusive end and start == end both mean one day", () => {
  for (const end of ["2031-02-28T00:00:00+07:00", "2031-02-27T00:00:00+07:00"]) {
    const v = validateEventArgs({ ...allDay, start_datetime: "2031-02-27T00:00:00+07:00", end_datetime: end });
    assertEquals(v.ok && v.args.end_datetime, "2031-02-28T00:00:00+07:00");
  }
});

Deno.test("all-day: a start given in UTC snaps to the local (WIB) date", () => {
  const v = validateEventArgs({ ...allDay, start_datetime: "2031-02-26T17:00:00Z", end_datetime: "2031-02-27T17:00:00Z" });
  assertEquals(v.ok && [v.args.start_datetime, v.args.end_datetime], ["2031-02-27T00:00:00+07:00", "2031-02-28T00:00:00+07:00"]);
});

Deno.test("all-day: multi-day kept, still capped at 14 days", () => {
  const v = validateEventArgs({ ...allDay, start_datetime: "2031-03-01T00:00:00+07:00", end_datetime: "2031-03-04T00:00:00+07:00" });
  assertEquals(v.ok && v.args.end_datetime, "2031-03-04T00:00:00+07:00");
  const tooLong = validateEventArgs({ ...allDay, start_datetime: "2031-03-01T00:00:00+07:00", end_datetime: "2031-03-20T00:00:00+07:00" });
  assertEquals(tooLong.ok, false);
});

Deno.test("timed events have no all_day field and keep their times", () => {
  const v = validateEventArgs({ title: "x", timezone: "Asia/Jakarta", start_datetime: "2031-02-27T09:00:00+07:00", end_datetime: "2031-02-27T10:00:00+07:00", all_day: false });
  assertEquals(v.ok && [v.args.start_datetime, "all_day" in v.args], ["2031-02-27T09:00:00+07:00", false]);
});
