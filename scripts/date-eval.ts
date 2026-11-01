// Date-accuracy test set for LUNA's intent LLM (OI-3). Runs real requests through LUNA's own
// provider + validation code with a FIXED "now", so expected answers are deterministic.
// Uses free OpenRouter requests (~1 per case). Reads keys from supabase/functions/.env; never prints them.
//
//   deno run --allow-read=supabase/functions/.env --allow-net=openrouter.ai,api.deepseek.com,jsr.io \
//     scripts/date-eval.ts [--no-hints]
import { buildProvider } from "../supabase/functions/_shared/llm/factory.ts";
import { validateEventArgs } from "../supabase/functions/_shared/calendar/validate.ts";
import { annotateExplicitDates, annotateRelativeDays, localNow, relativeDateTable } from "../supabase/functions/_shared/time.ts";
import { openDialogue } from "../supabase/functions/_shared/history.ts";
import type { ChatMessage } from "../supabase/functions/_shared/llm/provider.ts";

const TZ = "Asia/Jakarta";
const NOW = new Date("2026-10-15T03:00:00Z"); // Thursday 15 Oct 2026, 10:00 WIB
const withHints = !Deno.args.includes("--no-hints");

const u = (content: string): ChatMessage => ({ role: "user", content });
const a = (content: string): ChatMessage => ({ role: "assistant", content });

// `history` is passed through openDialogue, exactly like luna-intent does.
const CASES: { text: string; expect: [string, string] | "clarify"; history?: ChatMessage[] }[] = [
  { text: "besok jam 3 sore meeting 1 jam", expect: ["2026-10-16T15:00", "2026-10-16T16:00"] },
  { text: "lusa jam 9 pagi meeting 30 menit", expect: ["2026-10-17T09:00", "2026-10-17T09:30"] },
  { text: "besok lusa jam 2 siang rapat 1 jam", expect: ["2026-10-17T14:00", "2026-10-17T15:00"] },
  { text: "senin depan jam 9 pagi dokter gigi 30 menit", expect: ["2026-10-19T09:00", "2026-10-19T09:30"] },
  { text: "hari minggu jam 10 pagi olahraga 1 jam", expect: ["2026-10-18T10:00", "2026-10-18T11:00"] },
  { text: "jumat jam setengah 3 sore ngopi 1 jam", expect: ["2026-10-16T14:30", "2026-10-16T15:30"] },
  { text: "nanti malam jam 8 makan malam 2 jam", expect: ["2026-10-15T20:00", "2026-10-15T22:00"] },
  { text: "rabu minggu depan jam 1 siang presentasi 1 jam", expect: ["2026-10-21T13:00", "2026-10-21T14:00"] },
  { text: "tanggal 3 november jam 10 pagi seminar 2 jam", expect: ["2026-11-03T10:00", "2026-11-03T12:00"] },
  { text: "jadwalin meeting sama tim", expect: "clarify" },
  // OI-7 (Stage 3.1 T4): wrong weekday for a past explicit date must be questioned, not scheduled.
  { text: "bikinin jadwal meeting untuk hari minggu 1’ oktober jam 3 sore", expect: "clarify" },
  // OI-7: answering "iya" to LUNA's own question schedules exactly what was asked.
  {
    text: "iya",
    history: [
      u("bikinin jadwal meeting untuk hari minggu 1’ oktober jam 3 sore"),
      a("1 Oktober 2026 itu hari Kamis dan sudah lewat. Maksudnya Minggu, 18 Oktober 2026 pukul 15:00?"),
    ],
    expect: ["2026-10-18T15:00", "2026-10-18T16:00"],
  },
  // F3.1-8/9: all-day events and relative years (Nanda's live test, 2026-11-01).
  { text: 'Jadwalin tanggal 27 Februari 5 tahun kedepan seharian dengan notes "Come back to her"', expect: ["2031-02-27T00:00", "2031-02-28T00:00"] },
  {
    text: 'Seharian dengan notes "Come back to her"',
    history: [u("Jadwalin tanggal 27 Februari 5 tahun kedepan"), a("Jam berapa mulai acara tersebut?")],
    expect: ["2031-02-27T00:00", "2031-02-28T00:00"],
  },
  // F3.1-7: an earlier proposal must not be re-proposed for a new request.
  {
    text: "tes batal lusa jam 10 pagi",
    history: [
      u("tes kedaluwarsa besok jam 9 pagi 30 menit"),
      a('Proposed event (awaiting user confirmation): {"title":"Test Kedaluwarsa","start_datetime":"2026-10-16T09:00:00+07:00","end_datetime":"2026-10-16T09:30:00+07:00","timezone":"Asia/Jakarta"}'),
    ],
    expect: ["2026-10-17T10:00", "2026-10-17T11:00"],
  },
];

const envText = await Deno.readTextFile("supabase/functions/.env");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const provider = buildProvider((k) => env[k]);
const localHm = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 16);

let pass = 0;
console.log(`hints=${withHints} provider=${provider.name}\n`);
for (const c of CASES) {
  let verdict: string;
  try {
    const r = await provider.extractCalendarIntent({
      userText: withHints ? annotateRelativeDays(annotateExplicitDates(c.text, TZ, NOW), TZ, NOW) : c.text,
      nowLocal: localNow(TZ, NOW),
      timezone: TZ,
      // Same annotation of open-dialogue user turns as luna-intent.
      history: openDialogue(c.history ?? []).map((t) =>
        withHints && t.role === "user" ? { ...t, content: annotateRelativeDays(annotateExplicitDates(t.content, TZ, NOW), TZ, NOW) } : t
      ),
      calendarHints: withHints ? relativeDateTable(TZ, NOW) : undefined,
    });
    if (c.expect === "clarify") verdict = r.kind === "text" ? "OK" : "WRONG (guessed instead of asking)";
    else if (r.kind !== "tool_call") verdict = "WRONG (asked instead of scheduling)";
    else {
      const v = validateEventArgs(r.args);
      if (!v.ok) verdict = `INVALID (${v.errors[0]})`;
      else {
        const got: [string, string] = [localHm(v.args.start_datetime), localHm(v.args.end_datetime)];
        verdict = got[0] === c.expect[0] && got[1] === c.expect[1] ? "OK" : `WRONG (got ${got[0]}–${got[1].slice(11)})`;
      }
    }
  } catch (e) {
    verdict = `ERROR (${String(e).slice(0, 70)})`;
  }
  if (verdict === "OK") pass++;
  console.log(`${verdict === "OK" ? "✅" : "❌"} ${c.text.padEnd(48)} ${verdict}`);
  await new Promise((res) => setTimeout(res, 3500)); // stay under the free tier's 20 requests/min
}
console.log(`\nScore: ${pass}/${CASES.length}`);
