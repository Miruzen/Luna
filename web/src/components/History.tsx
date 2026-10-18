import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface WorkItemRow {
  id: string;
  status: string;
  summary: string | null;
  attempt: number;
  created_at: string;
  updated_at: string;
  last_result: { html_link?: string; error?: string } | null;
}

const LABEL: Record<string, string> = {
  proposed: "Menunggu konfirmasi",
  approved: "Disetujui",
  dispatched: "Sedang dikirim",
  needs_approval: "Butuh izin",
  needs_input: "Butuh info",
  completed: "Selesai",
  failed: "Gagal",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

// Reads the user's own work items (RLS: read-own). This is LUNA's shared state from Stage 2.
export function History({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<WorkItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("work_items")
      .select("id, status, summary, attempt, created_at, updated_at, last_result")
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as WorkItemRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [refreshKey]);

  // A proposal past 15 minutes is expired even if the DB row still says "proposed" (checked on confirm).
  const shownStatus = (it: WorkItemRow) =>
    it.status === "proposed" && Date.now() - Date.parse(it.created_at) > 15 * 60_000 ? "expired" : it.status;

  return (
    <div className="history">
      <div className="row between">
        <h2>Riwayat tugas</h2>
        <button className="ghost" onClick={load}>{loading ? "…" : "Muat ulang"}</button>
      </div>
      {!loading && items.length === 0 && <p className="muted">Belum ada tugas.</p>}
      <ul>
        {items.map((it) => {
          const s = shownStatus(it);
          return (
            <li key={it.id} className="card">
              <div className="row between">
                <strong>{it.summary ?? it.id}</strong>
                <span className={`badge ${s}`}>{LABEL[s] ?? s}</span>
              </div>
              <div className="muted small">
                Dibuat {new Date(it.created_at).toLocaleString("id-ID")} · percobaan {it.attempt}
                {it.last_result?.error && ` · ${it.last_result.error}`}
              </div>
              {it.last_result?.html_link && (
                <a className="small" href={it.last_result.html_link} target="_blank" rel="noreferrer">Buka event ↗</a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
