import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { CALLBACK_PATH, finishGoogleConnect, startGoogleConnect } from "./lib/google";
import { Login } from "./components/Login";
import { Chat } from "./components/Chat";
import { History } from "./components/History";

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<"chat" | "history">("chat");
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Back from Google's consent screen: finish the connection, then clean the URL.
  useEffect(() => {
    if (!session || window.location.pathname !== CALLBACK_PATH) return;
    finishGoogleConnect().then((msg) => {
      setNotice(msg);
      window.history.replaceState(null, "", "/");
    });
  }, [session]);

  if (session === undefined) return <div className="center muted">Memuat…</div>;
  if (!session) return <Login />;

  return (
    <div className="app">
      <header>
        <div className="brand">🌙 LUNA</div>
        <nav>
          <button className={tab === "chat" ? "tab on" : "tab"} onClick={() => setTab("chat")}>Chat</button>
          <button className={tab === "history" ? "tab on" : "tab"} onClick={() => setTab("history")}>Riwayat</button>
        </nav>
        <div className="row">
          <button className="ghost small" onClick={startGoogleConnect}>Hubungkan Google</button>
          <button className="ghost small" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
      </header>
      {notice && <div className="notice" onClick={() => setNotice(null)}>{notice} <span className="muted">(tutup)</span></div>}
      <main>
        <div style={{ display: tab === "chat" ? "contents" : "none" }}>
          <Chat onChange={() => setRefreshKey((k) => k + 1)} />
        </div>
        {tab === "history" && <History refreshKey={refreshKey} />}
      </main>
    </div>
  );
}
