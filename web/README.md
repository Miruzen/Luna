# LUNA web client

Vite + React + TypeScript (ADR-019). Talks only to LUNA's Supabase Edge Functions. All secrets stay server-side; this app holds public values only.

## Prerequisites
- Node.js 20+ and npm
- Deno (only for `npm test`)
- The LUNA backend deployed (see the root `README.md`) and a Supabase user (email + password) created in the dashboard: Authentication → Users → Add user

## Run locally
All commands run inside the `web` folder, not the repo root (the root has no `package.json`). The path contains a space, so keep the quotes. Run each line on its own (Windows PowerShell 5.1 does not support `&&`).

1. Install once:
   ```powershell
   cd "D:\Kerjaan\LUNA Project\Code\web"
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in the three public values:
   - `VITE_SUPABASE_URL`: `https://<project-ref>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: dashboard → Project Settings → API keys → publishable key (`sb_publishable_…`)
   - `VITE_GOOGLE_CLIENT_ID`: Google Cloud Console → Credentials → the Web OAuth client ID
3. `npm run dev` (still inside `web`), then open http://localhost:5173 (the port is fixed; CORS and the Google redirect allowlist expect it). Keep the terminal open while you use the app.
4. Sign in with the Supabase user.

## Backend configuration this app needs
These are server-side settings, set once per origin (`http://localhost:5173` locally, the Vercel URL later):

| Where | Setting | Value |
|---|---|---|
| Supabase secrets | `ALLOWED_ORIGINS` | comma-separated origins, e.g. `http://localhost:5173` |
| Supabase secrets | `GOOGLE_ALLOWED_REDIRECT_URIS` | includes `http://localhost:5173/google/callback` |
| Google Cloud Console → OAuth client → Authorized redirect URIs | | `http://localhost:5173/google/callback` |
| Google Cloud Console → OAuth consent screen → Test users | | the Google account whose calendar LUNA writes to |

Change secrets with `supabase secrets set NAME=value` (no redeploy needed).

## Connect Google Calendar
After signing in, click **Hubungkan Google**, approve on Google's screen, and you are sent back to `/google/callback`. The browser only receives an auth code; `auth-google-exchange` swaps it for tokens server-side.
While the OAuth app is in Testing mode, Google expires the refresh token after 7 days; LUNA then answers `google_reauth_required` and you connect again.

## Scripts
- `npm run dev`: dev server on port 5173
- `npm run build`: type-check and production bundle in `dist/`
- `npm test`: unit tests in `tests/` (Deno)

## Troubleshooting
- **`npm error enoent Could not read package.json`**: you are in the repo root. `cd "D:\Kerjaan\LUNA Project\Code\web"` first.
- **Blank page**: open the browser console (F12) and check for errors.
- **"Failed to send a request to the Edge Function"**: the origin is missing from `ALLOWED_ORIGINS`, or the Supabase project is paused (free projects pause after about 7 idle days; restore it in the dashboard).
- **Google says `redirect_uri_mismatch`**: the redirect URI is missing in Google Cloud Console.
- **`access_denied` from Google**: the Google account is not listed as a test user.
