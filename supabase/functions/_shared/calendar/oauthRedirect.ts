// Which redirect_uri a Google auth code may be exchanged with.
// "" is the Android serverAuthCode flow (always allowed). Anything else must be listed in
// GOOGLE_ALLOWED_REDIRECT_URIS (comma-separated, exact match), e.g. the local dev connect
// script's http://localhost:8765/callback. Returns null when the requested URI is not allowed.
export function resolveRedirectUri(requested: unknown, allowlist: string | undefined): string | null {
  if (requested === undefined || requested === null || requested === "") return "";
  if (typeof requested !== "string") return null;
  const allowed = (allowlist ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(requested) ? requested : null;
}
