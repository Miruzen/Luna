import type { ChatMessage } from "./llm/provider.ts";

// Assistant turns that close a dialogue: once LUNA has shown a confirm card (or it was cancelled,
// created or failed), the user decides on that card; the next message is a new request.
// Written by luna-intent, luna-cancel and luna-execute.
const CLOSING_PREFIXES = ["Proposed event", "Proposal cancelled", "Event created", "Event creation failed"];

// Only the still-open dialogue goes to the LLM (F3.1-7, Stage 3.1): with older proposals in the
// history, the free model re-proposed a previous event ("tes batal lusa jam 10" came back as the
// earlier "Test Kedaluwarsa, besok 09:00"). Clarifying questions and their answers stay, so
// "Minggu 18 Oktober jam 15:00?" -> "iya" still works.
// Trade-off: a follow-up edit after a card ("ganti jadi jam 4") is no longer understood; LUNA asks
// for the full request instead.
export function openDialogue(turns: ChatMessage[]): ChatMessage[] {
  let start = 0;
  turns.forEach((t, i) => {
    if (t.role === "assistant" && CLOSING_PREFIXES.some((p) => t.content.startsWith(p))) start = i + 1;
  });
  return turns.slice(start);
}
