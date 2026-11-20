// Tailwind is used for LAYOUT utilities only. Colours/fonts come from CSS vars set in src/lib/theme.js.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: { brand: 'var(--brand)', ok: 'var(--ok)', warn: 'var(--warn)', crit: 'var(--crit)', ink: 'var(--ink)', dim: 'var(--dim)', line: 'var(--line)' },
    fontFamily: { display: 'var(--font-display)', mono: 'var(--font-mono)' },
  } },
  plugins: [],
}
