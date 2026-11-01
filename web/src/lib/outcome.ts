// How the UI reads LUNA's execute results. Pure (no imports) so it can be tested with
// `deno test` from web/tests without a browser or bundler.

export type ExecuteResult =
  | { ok: true; event_id: string; html_link: string }
  | { ok: false; error: string; details?: string[]; event_id?: string; html_link?: string };

// Card states:
// - pending: waiting for "Setuju" / "Batal" (also after google_not_connected: connect, then tap again)
// - busy: request in flight
// - done: event created and accepted by LUNA
// - retry: failed or unknown, but safe to try again (luna-execute is idempotent on the id, ADR-018)
// - failed: final; trying again cannot help
// - cancelled: user declined
export type CardState = "pending" | "busy" | "done" | "retry" | "failed" | "cancelled";

// Errors after which pressing the same card again can succeed. Mirrors luna-execute: every failure
// except acceptance_failed is stored as retryable; in_progress means "still running, ask again".
const RETRYABLE = new Set(["google_reauth_required", "calendar_error", "timeout", "in_progress"]);

// `null` means the request itself failed (network, CORS, server down): the outcome is unknown, and
// asking again is safe because a completed item is replayed instead of executed twice.
export function cardStateAfterExecute(r: ExecuteResult | null): CardState {
  if (r === null) return "retry";
  if (r.ok) return "done";
  if (r.error === "google_not_connected") return "pending";
  return RETRYABLE.has(r.error) ? "retry" : "failed";
}

// Full sentences for the chat.
export const ERROR_TEXT: Record<string, string> = {
  google_not_connected: "Google Calendar belum terhubung. Klik \"Hubungkan Google\" di atas, lalu tekan Setuju lagi.",
  google_reauth_required: "Izin Google kedaluwarsa. Klik \"Hubungkan Google\" lagi, lalu tekan \"Coba lagi\".",
  expired: "Kartu konfirmasi ini sudah kedaluwarsa (lebih dari 15 menit). Minta ulang ke LUNA.",
  in_progress: "Masih diproses. Tunggu sebentar lalu tekan \"Coba lagi\" untuk cek hasilnya.",
  timeout: "Proses sebelumnya tidak selesai. Tekan \"Coba lagi\".",
  not_executable: "Tugas ini sudah dibatalkan atau tidak bisa dijalankan lagi.",
  acceptance_failed: "Event dibuat, tapi tidak sesuai yang kamu setujui. Cek dan hapus lewat link-nya.",
  calendar_error: "Google Calendar sedang error. Tekan \"Coba lagi\" sebentar lagi.",
  not_found: "Kartu konfirmasi tidak ditemukan.",
  invalid_args: "Detail jadwal tidak valid. Minta ulang ke LUNA.",
};

// Short labels for the history list.
const ERROR_LABEL: Record<string, string> = {
  google_not_connected: "Google belum terhubung",
  google_reauth_required: "Izin Google kedaluwarsa",
  expired: "Kedaluwarsa",
  in_progress: "Masih diproses",
  timeout: "Proses terputus",
  not_executable: "Tidak bisa dijalankan",
  acceptance_failed: "Event tidak sesuai persetujuan",
  calendar_error: "Google Calendar error",
  not_found: "Tidak ditemukan",
  invalid_args: "Detail jadwal tidak valid",
};

export const errorText = (code: string) => ERROR_TEXT[code] ?? `Gagal (${code}).`;
export const errorLabel = (code: string) => ERROR_LABEL[code] ?? `Gagal (${code})`;
