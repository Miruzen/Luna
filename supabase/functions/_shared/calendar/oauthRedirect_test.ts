import { assertEquals } from "jsr:@std/assert@1";
import { resolveRedirectUri } from "./oauthRedirect.ts";

const allow = "http://localhost:8765/callback";

Deno.test("redirect: missing/empty means the Android flow", () => {
  assertEquals(resolveRedirectUri(undefined, allow), "");
  assertEquals(resolveRedirectUri("", undefined), "");
});

Deno.test("redirect: allowlisted URI is accepted (exact match)", () => {
  assertEquals(resolveRedirectUri("http://localhost:8765/callback", allow), "http://localhost:8765/callback");
});

Deno.test("redirect: anything not allowlisted is refused", () => {
  assertEquals(resolveRedirectUri("http://evil.example/callback", allow), null);
  assertEquals(resolveRedirectUri("http://localhost:8765/callback/", allow), null);
  assertEquals(resolveRedirectUri("http://localhost:8765/callback", undefined), null);
  assertEquals(resolveRedirectUri(42, allow), null);
});
