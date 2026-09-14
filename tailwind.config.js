/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './services/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // THE LABEL — five faces, five jobs. Names are set, what a thing is FOR
        // is written, specs are printed small, the body is the game talking,
        // and the monospace is reserved for an actual instrument reading.
        sans: ['Work Sans', 'sans-serif'],
        display: ['Playfair Display', 'Georgia', 'serif'],
        desc: ['Cormorant Garamond', 'Georgia', 'serif'],
        spec: ['Barlow Condensed', 'Work Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      colors: {
        // Warm artisan-workshop palette — replaces the old neon slate/emerald
        // lab-dashboard scheme. Kept as Tailwind tokens too so any remaining
        // utility-class usage (in components not fully bespoke-styled) can
        // still reach for the right color by name.
        void: '#15100b',
        panel: '#1e1710',
        'panel-raised': '#28201664',
        cubby: '#0f0b07',
        hi: '#f4ead9',
        mid: '#c3b39a',
        lo: '#b19f81',
        amber: {
          DEFAULT: 'oklch(72% 0.15 55)',
          deep: 'oklch(50% 0.13 50)',
        },
        moss: {
          DEFAULT: 'oklch(70% 0.11 145)',
          deep: 'oklch(46% 0.09 145)',
        },
        brick: 'oklch(58% 0.17 30)',
        plum: 'oklch(68% 0.12 320)',
        teal: 'oklch(68% 0.10 200)',
        brass: 'oklch(80% 0.09 85)',
      },
      boxShadow: {
        lantern: '0 40px 100px rgba(0,0,0,0.55)',
      },
    },
  },
  plugins: [],
};
