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
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
