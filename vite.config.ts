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
  // KEEP READABLE IDENTIFIERS. The page is published as one file, and the host's
  // publish-time validator rejected every build after commit eef2301 as a
  // "PR review page" — not because of anything we wrote, but because the
  // minifier's generated short names (which reshuffle on every code change)
  // happened to trip its classifier. Bisected: the identical code built with
  // readable names publishes; the minified build of the same commit does not,
  // and rewording or removing our own strings changed nothing. Costs ~0.5 MB of
  // a 5 MB page (most of which is pictures). Whitespace and syntax are still
  // minified. See CLAUDE.md, "Publishing the page".
  esbuild: {
    minifyIdentifiers: false,
    // Every JSX call goes through i18n/jsx-runtime, which translates what is about
    // to be drawn when the page is in another language and is React's own runtime
    // in English (i18n/engine.ts). Set here and not on the React plugin, which
    // would also pre-bundle the runtime as a dependency and freeze its dictionary.
    jsxImportSource: 'fermenta-i18n',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // The JSX runtime lives in the project. Named and aliased (not '@/i18n') so
      // Vite resolves it as source rather than pre-bundling it as a dependency,
      // which would freeze the dictionary it imports.
      'fermenta-i18n': path.resolve(__dirname, 'i18n'),
    },
  },
});
