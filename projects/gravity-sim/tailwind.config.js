/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'cinzel': ['Cinzel', 'serif'],
        'crimson': ['Crimson Text', 'serif'],
      },
      colors: {
        'parchment': {
          DEFAULT: 'hsl(var(--parchment))',
          dark: 'hsl(var(--parchment-dark))',
        },
        'manuscript': {
          DEFAULT: 'hsl(var(--manuscript-brown))',
          dark: 'hsl(var(--manuscript-dark))',
        },
        'ink': {
          DEFAULT: 'hsl(var(--ink-black))',
          fade: 'hsl(var(--ink-fade))',
        },
        'gold': 'hsl(var(--gold-accent))',
        'copper': 'hsl(var(--copper-accent))',
      },
    },
  },
  plugins: [],
};
