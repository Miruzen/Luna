// Regression tests for F3.1-1 / F3.1-2 (Stage 3.1). Run: `npm test` (needs Deno).
import { assertEquals } from "jsr:@std/assert@1";
import { cardStateAfterExecute, errorLabel, errorText } from "../src/lib/outcome.ts";

const fail = (error: string) => ({ ok: false as const, error });

Deno.test("success marks the card done", () => {
  assertEquals(cardStateAfterExecute({ ok: true, event_id: "x", html_link: "https://example.com" }), "done");
});

// F3.1-1: retryable failures used to show "Diproses" with no buttons.
for (const code of ["google_reauth_required", "calendar_error", "timeout", "in_progress"]) {
  Deno.test(`${code} can be retried from the same card`, () => {
    assertEquals(cardStateAfterExecute(fail(code)), "retry");
  });
}

Deno.test("network failure (unknown outcome) can be retried", () => {
  assertEquals(cardStateAfterExecute(null), "retry");
});

Deno.test("google_not_connected keeps the card pending (connect, then approve)", () => {
  assertEquals(cardStateAfterExecute(fail("google_not_connected")), "pending");
});

for (const code of ["expired", "not_executable", "not_found", "acceptance_failed", "invalid_args", "something_new"]) {
  Deno.test(`${code} is final and never shown as success`, () => {
    assertEquals(cardStateAfterExecute(fail(code)), "failed");
  });
}

// F3.1-2: history showed raw codes.
Deno.test("known error codes get readable text", () => {
  assertEquals(errorLabel("calendar_error"), "Google Calendar error");
  assertEquals(errorText("expired").includes("kedaluwarsa"), true);
});

Deno.test("unknown error codes still say Gagal", () => {
  assertEquals(errorLabel("weird"), "Gagal (weird)");
  assertEquals(errorText("weird"), "Gagal (weird).");
});
