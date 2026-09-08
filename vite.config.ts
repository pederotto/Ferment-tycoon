import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The project began life as an AI Studio export, which wired a Gemini API key
// through `define`. Nothing in the game ever called it — the simulation is
// entirely local and deterministic — so that plumbing is gone.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    // Vite 6 rejects any request whose Host header it does not recognise, which
    // is exactly what a tunnel sends — LAN IPs are allowed already, hostnames
    // are not. Listed rather than `true` so the DNS-rebinding guard stays on for
    // everything else.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt'],
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
