import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true lets a phone on the same Wi-Fi open the dev server.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, host: true },
});
