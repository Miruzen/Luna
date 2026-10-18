import { useEffect, useRef, useState } from "react";
import { cancel, ERROR_TEXT, execute, intent, type IntentResult } from "../lib/luna";

type Card = Extract<IntentResult, { kind: "confirm" }> & { state: "pending" | "busy" | "done" | "cancelled" };
interface Message {
  id: number;
  role: "user" | "luna";
  text?: string;
  card?: Card;
  link?: string;
}

// deno-lint-ignore no-explicit-any
const SpeechRecognitionImpl: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export function Chat({ onChange }: { onChange: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, role: "luna", text: "Halo! Mau dijadwalkan apa? Contoh: \"besok jam 3 sore meeting sama tim 1 jam\"." },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  // Braces matter: newer Chrome returns a Promise from scrollIntoView, and an effect must not
  // return anything but a cleanup function (React crashed with "destroy is not a function").
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const push = (m: Omit<Message, "id">) => setMessages((ms) => [...ms, { ...m, id: nextId.current++ }]);
  const updateCard = (cid: string, patch: Partial<Card>) =>
    setMessages((ms) => ms.map((m) => (m.card?.confirmation_id === cid ? { ...m, card: { ...m.card, ...patch } } : m)));

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    setInput("");
    push({ role: "user", text: t });
    setThinking(true);
    try {
      const r = await intent(t, sessionId);
      if ("error" in r) push({ role: "luna", text: "Maaf, LUNA gagal memproses. Coba lagi." });
      else {
        setSessionId(r.session_id);
        if (r.kind === "clarification") push({ role: "luna", text: r.question });
        else push({ role: "luna", card: { ...r, state: "pending" } });
        onChange();
      }
    } catch (e) {
      push({ role: "luna", text: `Error: ${(e as Error).message}` });
    } finally {
      setThinking(false);
    }
  }

  async function confirm(card: Card) {
    updateCard(card.confirmation_id, { state: "busy" });
    try {
      const r = await execute(card.confirmation_id);
      if (r.ok) {
        updateCard(card.confirmation_id, { state: "done" });
        push({ role: "luna", text: "✅ Sudah masuk ke Google Calendar.", link: r.html_link });
      } else {
        updateCard(card.confirmation_id, { state: r.error === "google_not_connected" ? "pending" : "done" });
        push({ role: "luna", text: ERROR_TEXT[r.error] ?? `Gagal: ${r.error}`, link: r.html_link });
      }
    } catch (e) {
      updateCard(card.confirmation_id, { state: "pending" });
      push({ role: "luna", text: `Error: ${(e as Error).message}` });
    }
    onChange();
  }

  async function decline(card: Card) {
    updateCard(card.confirmation_id, { state: "busy" });
    const r = await cancel(card.confirmation_id).catch((e) => ({ ok: false, error: (e as Error).message }));
    updateCard(card.confirmation_id, { state: r.ok ? "cancelled" : "pending" });
    push({ role: "luna", text: r.ok ? "Oke, dibatalkan." : `Gagal membatalkan: ${r.error}` });
    onChange();
  }

  function listen() {
    if (!SpeechRecognitionImpl) return alert("Browser ini belum mendukung input suara. Pakai Chrome.");
    const rec = new SpeechRecognitionImpl();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.onresult = (e: { results: { 0: { transcript: string } }[] }) => setInput(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    setListening(true);
    rec.start();
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.text && <p>{m.text}</p>}
            {m.link && <a href={m.link} target="_blank" rel="noreferrer">Buka di Google Calendar ↗</a>}
            {m.card && (
              <div className="confirm">
                <div className="confirm-title">📅 {m.card.args.title}</div>
                <div className="muted">{m.card.summary.split(" — ").slice(1).join(" — ")}</div>
                {m.card.args.description && <div className="muted small">{m.card.args.description}</div>}
                {m.card.state === "pending" && (
                  <div className="row">
                    <button onClick={() => confirm(m.card!)}>Setuju</button>
                    <button className="ghost" onClick={() => decline(m.card!)}>Batal</button>
                  </div>
                )}
                {m.card.state === "busy" && <div className="muted small">Memproses…</div>}
                {m.card.state === "done" && <div className="muted small">Diproses</div>}
                {m.card.state === "cancelled" && <div className="muted small">Dibatalkan</div>}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="bubble luna muted">LUNA sedang berpikir…</div>}
        <div ref={bottom} />
      </div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <button type="button" className={`mic ${listening ? "on" : ""}`} onClick={listen} title="Bicara">🎤</button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? "Mendengarkan…" : "Ketik atau tekan 🎤"} />
        <button type="submit" disabled={thinking || !input.trim()}>Kirim</button>
      </form>
    </div>
  );
}
