import { createClient } from "@supabase/supabase-js";

// Only public values: the publishable key is designed to ship to browsers. Secrets stay in the
// Edge Functions (CLAUDE.md safety rules).
const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
if (!url || !key) throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY (see web/.env.example)");

export const supabase = createClient(url, key);
