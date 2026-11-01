// F3.1-7 (Stage 3.1 T4): only the open dialogue reaches the LLM.
import { assertEquals } from "jsr:@std/assert@1";
import { openDialogue } from "./history.ts";
import type { ChatMessage } from "./llm/provider.ts";

const u = (content: string): ChatMessage => ({ role: "user", content });
const a = (content: string): ChatMessage => ({ role: "assistant", content });

Deno.test("an earlier proposal does not reach the next request (the Test B bug)", () => {
  const turns = [
    u("tes kedaluwarsa besok jam 9 pagi 30 menit"),
    a('Proposed event (awaiting user confirmation): {"title":"Test Kedaluwarsa"}'),
  ];
  assertEquals(openDialogue(turns), []);
});

Deno.test("cancelled, created and failed outcomes also close the dialogue", () => {
  for (const closing of ["Proposal cancelled by the user.", "Event created: Rapat", "Event creation failed: calendar_error"]) {
    assertEquals(openDialogue([u("x"), a("Proposed event: {}"), a(closing), u("lusa jam 10")]), [u("lusa jam 10")]);
  }
});

Deno.test("a clarification dialogue stays, so 'iya' keeps its context (OI-7)", () => {
  const turns = [
    u("old request"),
    a("Proposed event: {}"),
    u("meeting hari minggu 1 oktober jam 3 sore"),
    a("1 Oktober 2026 itu Kamis dan sudah lewat. Maksudnya Minggu, 18 Oktober 2026 pukul 15:00?"),
  ];
  assertEquals(openDialogue(turns), turns.slice(2));
});

Deno.test("no closing turn: the whole history stays", () => {
  const turns = [u("jadwalin meeting"), a("Kapan?")];
  assertEquals(openDialogue(turns), turns);
});
