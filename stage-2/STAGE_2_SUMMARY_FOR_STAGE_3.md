# LUNA — Ringkasan Stage 2 (bahan untuk merancang Stage 3)

> **Untuk AI yang membaca file ini:** ini ringkasan lengkap proyek LUNA sampai akhir Stage 2 (per 2026-10-18). Kamu tidak punya akses ke repo; semua yang perlu diketahui ada di sini. Tolong bantu Nanda merancang **Stage 3**. Hormati keputusan yang sudah **ACCEPTED** (bagian 6) kecuali ada alasan kuat. Kalau mau mengusulkan perubahan, jelaskan trade-off-nya. Bedakan fakta, asumsi, dan rekomendasi.
>
> Label: **[FAKT]** sudah terverifikasi di kode atau live · **[BELUM]** belum dibangun/diuji · **[OPEN]** belum diputuskan.

---

## 1. Apa itu LUNA

LUNA adalah **personal AI milik Nanda** dan pusat arsitektur proyek ini.

```
Nanda → LUNA → execution layer (rencananya: Jarvis / OpenJarvis) → eksekusi → LUNA → Nanda
```

**Hierarki keputusan:**
1. **Nanda**: otoritas tertinggi. Menyetujui setiap aksi yang keluar ke dunia luar (bikin event, kirim pesan, dll.).
2. **LUNA**: pengambil keputusan kedua. Menentukan intent, apa yang didelegasikan, batasan dan izinnya, lalu menilai hasilnya. Hanya bertindak dalam batas yang disetujui Nanda.
3. **Execution layer (Jarvis)**: tidak membuat keputusan strategis. Hanya menentukan **BAGAIMANA** mengerjakan tugas, dalam izin yang diberikan LUNA. Persetujuan LUNA = otorisasinya; Jarvis tidak bertanya ulang.

Layer bawah tidak boleh memperluas wewenangnya sendiri. Kalau ragu, eskalasi ke atas: Jarvis → LUNA → Nanda.

**Pembagian tanggung jawab:**
- **LUNA = WHO / WHY / WHAT:** identitas, relasi dengan user, intent, konteks, misi, hasil yang diinginkan, delegasi, batasan, izin, evaluasi strategis, penerimaan hasil.
- **Jarvis = HOW:** perencanaan eksekusi, agent eksekusi, koordinasi agent, pemakaian tool/MCP, retry dalam satu attempt, verifikasi level tool.
- **Invarian:** kalau Jarvis dibuang besok, inti strategis LUNA tetap utuh; hanya implementasi di balik *Execution Interface* yang diganti.

## 2. Konteks dan batasan Nanda (penting untuk desain)

- Solo developer. Engineering dikerjakan bersama Claude Code; Nanda adalah pemilik arsitektur.
- **Budget hemat:** AI pakai **cloud API saja** (tidak ada model lokal); saat ini memakai **model gratis** via OpenRouter.
- Infrastruktur free tier: Supabase Free (project pause setelah ~7 hari idle; batas waktu function 150 detik); Google OAuth app masih mode *Testing* (refresh token kedaluwarsa tiap 7 hari).
- Gaya kerja: langkah terkecil yang jalan dulu, lalu iterasi. Hindari over-engineering. Pekerjaan dibagi per stage dengan dokumen keputusan dan progres.
- Bahasa interaksi dengan LUNA: Indonesia (contoh: "besok jam 3 sore meeting sama tim").

## 3. Stack teknis saat ini [FAKT]

| Bagian | Teknologi |
|---|---|
| Backend | Supabase: Postgres + Edge Functions (Deno/TypeScript) |
| Edge Functions | `luna-intent` (pahami permintaan → usulkan aksi), `luna-execute` (jalankan aksi yang sudah dikonfirmasi), `luna-cancel` (batalkan usulan), `auth-google-exchange` (sambungkan Google) |
| LLM | Lewat abstraksi provider (`_shared/llm/`), OpenRouter sebagai satu jalur + fallback ke provider lain (ADR-016). Model saat ini gratis (`nvidia/nemotron-3.5-lightning:free`) |
| Integrasi | Google Calendar: **create event** (satu-satunya aksi nyata saat ini) |
| Client | **Web app** (`web/`): Vite + React + TypeScript, target hosting Vercel. Android app di-pause |
| Jarvis | **Belum tersambung.** Adapter-nya sudah ada tapi hanya diuji dengan mock |
| Tes | 72 unit test backend lulus (2026-10-15) + beberapa tes end-to-end live |

**Alur live saat ini (calendar):**
1. Nanda mengetik/bicara → `luna-intent` → LLM mengusulkan aksi terstruktur → backend memvalidasi → **confirm card**.
2. Nanda menekan konfirmasi → `luna-execute` menjalankan **argumen yang tersimpan di server** (bukan yang dikirim client) → event dibuat di Google Calendar.
3. LUNA mengecek hasilnya cocok dengan yang disetujui (*acceptance check*) → Nanda melihat hasil dan link event.

Catatan: kalender saat ini dijalankan **langsung oleh LUNA**, bukan lewat Jarvis. Rencananya dipindah ke Jarvis (ADR-011) setelah hosting Jarvis diputuskan.

## 4. Stage 1 (selesai 2026-10-14), singkat

- Arsitektur target dan peta arsitektur yang ada didokumentasikan.
- Recon source code OpenJarvis (commit `c14f579`): Python + ekstensi Rust wajib, single-user, Google Calendar-nya read-only (tidak bisa bikin event), punya memori/persona sendiri.
- **Kontrak eksekusi** dibuat (engine-agnostic):
  - `ExecutionRequest`: `request_id`, `objective`, `context[]`, `constraints[]`, `expected_output`, `permissions[]` (aksi outward wajib ada approval Nanda), `approval`, `operational_state {attempt}`.
  - `ExecutionResult`: `status` ∈ `completed | failed | needs_approval | needs_input | rejected`, plus `result`, `evidence`, `actions_taken`, `artifacts`, `errors[] {code, message, retryable}`, `next_recommendation`.
  - `ExecutionEngine.execute()` + `delegate()` sebagai *Execution Interface*.
- Adapter Jarvis (mock) + 39 tes.
- V0.1 end-to-end live: intent → konfirmasi → event Google Calendar asli → retry idempotent.

## 5. Stage 2: apa yang dikerjakan (2026-10-14 s/d 2026-10-15)

**Tujuan Stage 2:** mendefinisikan *shared state* dan batas konteks supaya LUNA bisa mendelegasikan dengan andal. Tiga workstream, semuanya selesai dan disetujui Nanda.

### 5.1 Workstream 1: Shared State [FAKT, live]
- **Unit kerja = work item**: satu aksi yang LUNA usulkan dan mungkin jalankan. Belum ada level misi/parent (bisa ditambah nanti tanpa breaking change).
- **Satu ID sepanjang siklus hidup:** `work_item.id` = `confirmation_id` = `request_id` = kunci idempotensi (juga dipakai sebagai Google event id).
- **Lifecycle (10 status):**

```
proposed ──► approved ──► dispatched ──► completed | failed | rejected
   │                         │   ▲            │
   ├──► cancelled            │   └── retry ───┘ (hanya kalau error retryable; id sama, attempt+1)
   └──► expired (TTL 15 mnt) ├──► needs_approval ──► approved | cancelled
                             └──► needs_input    ──► dispatched | cancelled
```

- **Single writer:** hanya backend LUNA yang menulis state. Nanda (via client) dan engine (via `ExecutionResult`) hanya *meminta*; LUNA memvalidasi dulu. Transisi yang tidak terdaftar ditolak.
- Tabel `work_items` (state saat ini) + `work_item_events` (audit trail append-only).
- Menutup dua celah keamanan: dulu server menjalankan argumen kiriman client dan confirm card tidak pernah kedaluwarsa.
- Kasus keandalan: double-tap konfirmasi = no-op; hasil telat dari attempt lama diabaikan (`stale_result`); item `dispatched` lebih dari 150 detik → `failed` (timeout, retryable) lalu di-retry dengan id yang sama.
- Tabel lama `calendar_events_log` dihapus (DEC-004) agar hanya ada satu sumber kebenaran.

### 5.2 Workstream 2: Context Projection [FAKT di kode, belum dipakai live]
- **Prinsip: default deny per capability.** Tiap capability (mis. `calendar.events.create`) punya *projection policy* yang mendaftar persis konteks apa yang boleh dikirim ke executor. Konteks lain tidak dikirim.
- **Projector berupa kode deterministik, bukan AI.** Hanya ada satu interpretasi AI (di `luna-intent`), dan itu yang Nanda cek di confirm card.
- Tambahan kontrak (opsional, backward compatible): `inputs` (data terstruktur yang sudah divalidasi, agar executor tidak menafsirkan ulang teks) dan `ContextItem.source` (untuk jejak audit).
- **Tidak dikirim secara default:** ucapan mentah user, riwayat percakapan, preferensi/fakta pribadi. Kredensial tidak pernah masuk ke konteks.
- Konteks wajib hilang → tidak di-dispatch, error `missing_context`. Konteks saling bertentangan → LUNA bertanya ke Nanda; executor tidak pernah memilih sendiri.
- **[FAKT] Belum ada long-term memory / profile store.** "Konteks pribadi" saat ini hanya timezone + 10 giliran percakapan terakhir.

### 5.3 Workstream 3: Agent & Tool Ownership [FAKT, divalidasi terhadap source Jarvis]
- Peta 18 tanggung jawab LUNA / interface / Jarvis disetujui. Aturan inti: **Jarvis boleh mengubah HOW, tidak pernah WHAT.**
- Tiga temuan dari source Jarvis:
  - **F1:** Jarvis tidak punya langkah verifikasi hasil generik → **ADR-017**: Jarvis cek "tool call berhasil", LUNA cek "hasilnya sesuai yang disetujui Nanda".
  - **F2:** ada dua lapis retry (Jarvis ×3 dalam satu attempt, LUNA antar-attempt) → **ADR-018**: setiap aksi outward wajib idempotent pada `request_id`.
  - **F3:** adapter salah melaporkan "max turns reached" Jarvis sebagai `completed` → sudah diperbaiki menjadi `failed` (`engine_incomplete`, retryable).

### 5.4 Item lanjutan yang diselesaikan di akhir Stage 2
- **OI-1** Timeout recovery: 150 detik (batas function Supabase Free), retry dengan id sama. Terverifikasi live.
- **OI-2** Acceptance check kalender: judul + jam mulai/selesai dibandingkan dengan yang disetujui; kalau tidak cocok → `failed` + Nanda diberi tahu. Live.
- **OI-3** Akurasi tanggal model gratis ("lusa" salah dibaca): diperbaiki tanpa model berbayar. Kode menghitung tabel tanggal + menganotasi kata relatif ("lusa (Sabtu 2026-10-17)"). Skor eval 5/10 → **10/10** (single run; model gratis bervariasi).

### 5.5 Ekstensi Stage 2: Web client (DEC-007 / ADR-019) [sebagian BELUM]
- Alasan: Nanda ingin melihat dan menguji progres langsung sebelum membangun Android.
- Fitur v1: login, chat (teks + mic via Web Speech API, bahasa Indonesia), confirm/cancel card, hasil + link event, panel riwayat work item, tombol "Connect Google".
- Backend: CORS di semua Edge Function + endpoint `luna-cancel`.
- Status: **sudah dibangun dan jalan di lokal; belum diuji Nanda, belum di-deploy ke Vercel.**

## 6. Keputusan yang sudah berlaku (decision log)

| ID | Keputusan |
|---|---|
| ADR-001…010 | LUNA pusat; Jarvis execution layer; batas engine-agnostic (Execution Interface); agent milik execution layer; agent tidak otomatis menerima seluruh memori LUNA; source Jarvis wajib diinspeksi sebelum integrasi |
| ADR-011 | Pembuatan event kalender pindah ke Jarvis dengan menambah capability create-event (**accepted, belum dikerjakan**). Syarat: pakai `request_id` sebagai event id, tanpa konfirmasi sendiri, mengembalikan jam event untuk acceptance check |
| ADR-012 | Hierarki keputusan Nanda → LUNA → execution layer |
| ADR-013 | Kredensial dimiliki LUNA (Supabase). Approval LUNA = otorisasi Jarvis. Cara kredensial sampai ke Jarvis **[OPEN]** (usulan: access token pendek per request) |
| ADR-014 | Fork-first: OpenJarvis jadi git subtree di folder khusus dalam repo LUNA (**belum dieksekusi**, perlu go-ahead) |
| ADR-015 | Memori/persona Jarvis **dimatikan** saat dipakai LUNA; review ~2027-01 |
| ADR-016 | OpenRouter sebagai satu jalur LLM, tidak pernah satu-satunya; ada fallback provider |
| ADR-017 | Verifikasi dibagi: Jarvis cek tool-level, LUNA menerima outcome |
| ADR-018 | Aksi outward idempotent pada work-item id |
| ADR-019 | Client pertama = web app (Vercel), sebelum Android |

**Aturan keamanan permanen:**
- Secret hanya di server (Supabase Edge Function secrets), tidak pernah di client atau git.
- LLM hanya mengusulkan aksi terstruktur; backend memvalidasi; LLM tidak pernah mengeksekusi langsung.
- Setiap aksi outward butuh konfirmasi eksplisit Nanda **per aksi**.
- Provider LLM harus bisa diganti (kode khusus provider hanya di satu folder).
- Waktu lokal + timezone (default `Asia/Jakarta`) selalu disuntikkan ke prompt LLM.

## 7. Item yang masih terbuka [OPEN]

| ID | Item | Keputusan yang dibutuhkan |
|---|---|---|
| D-01 / OI-4 | **Menyambungkan Jarvis:** hosting (PC vs VPS; Nanda sedang riset VPS), menambah subtree, tool create-event, transport nyata, tes runtime Jarvis + tool calling via OpenRouter | Pilih hosting → go-ahead subtree. Arah transport yang disukai: **"mailbox"/pull** (LUNA menulis request ke antrean Supabase, Jarvis polling dan mengklaim; tanpa koneksi masuk/tunnel) |
| OI-5 | Batas free tier: refresh token Google kedaluwarsa tiap 7 hari; Supabase pause setelah ~7 hari idle | Google: tetap Testing atau pindah ke Production (muncul peringatan unverified app). Supabase: terima, keep-alive, atau berbayar |
| OI-6 | Keandalan model gratis: 2 dari 10 request timeout (>20 detik); fallback DeepSeek tidak punya saldo | Naikkan timeout (mis. 30 detik), isi saldo DeepSeek sedikit, atau terima dulu |
| OI-7 | Kebingungan multi-turn: setelah Nanda menjawab "iya", LUNA bertanya hal lain dengan hari/tanggal yang salah (tidak ada yang dieksekusi) | Anotasi tanggal eksplisit lewat kode juga; tambah kasus multi-turn ke eval; pertimbangkan model berbayar. Di-pause oleh Nanda |
| — | Web client: tes lokal oleh Nanda, redirect URI Google, deploy ke Vercel | Langkah manual Nanda, lalu deploy |

## 8. Apa yang BELUM ada (celah yang relevan untuk Stage 3)

- **Long-term memory / profil / preferensi Nanda**: belum ada sama sekali.
- **Multi-step mission** (satu permintaan → beberapa langkah): belum ada; semua aksi single-shot.
- **Jarvis nyata**: belum ditarik masuk, belum di-host, belum ada transport, belum pernah dijalankan.
- **Capability selain buat event kalender**: belum ada (baca kalender, email, pesan, reminder, dll.).
- **Permissions/risk framework** umum: baru per-capability sederhana.
- **Scheduler / aksi proaktif** (LUNA bertindak tanpa diminta, reminder, briefing): belum ada.
- **Model routing**: belum ada pemilihan model per tugas; fallback hanya saat error.
- **Android app**: di-pause.

Semua item di atas memang sengaja **di luar scope Stage 2**.

## 9. Pertanyaan untuk merancang Stage 3

Bahan diskusi, belum diputuskan:

1. **Fokus utama Stage 3**, salah satu atau kombinasi:
   - a) Menyambungkan Jarvis sungguhan (hosting, subtree, transport mailbox, create-event pindah ke Jarvis);
   - b) Menambah capability baru di LUNA (baca jadwal, reminder, email, dll.) dengan pola yang sama;
   - c) Memory/profil Nanda (apa yang diingat, bagaimana di-project ke tugas);
   - d) Memperkuat yang sudah ada (akurasi/keandalan model, deploy web, free-tier limits) sebelum ekspansi.
2. Apakah Jarvis memang dibutuhkan **sekarang**, atau LUNA cukup mengeksekusi capability sederhana sendiri dulu (lewat Execution Interface yang sama) sampai ada tugas yang benar-benar butuh multi-agent?
3. Capability apa yang paling memberi nilai harian untuk Nanda?
4. Berapa budget bulanan yang realistis (model berbayar, VPS, Supabase berbayar)?
5. Apa definisi "selesai" Stage 3 yang bisa diuji Nanda sendiri lewat web app?

## 10. Prinsip kerja yang perlu dipertahankan di Stage 3

- Urutan integrasi: Discover → Understand → Map → Compare → Recommend → Approve → Integrate.
- Inspeksi source asli sebelum integrasi; jangan percaya dokumentasi saja.
- Jangan bangun arsitektur spekulatif untuk stage berikutnya.
- Setiap keputusan dicatat (decision log) dan setiap progres dicatat (progress file) agar bisa ditelusuri ulang.
- Langkah terkecil yang berfungsi dulu, lalu iterasi.
