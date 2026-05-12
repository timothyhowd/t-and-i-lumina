import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Slate-aligned with the demo's design tokens.
        ink: '#0f172a',
        'ink-2': '#334155',
        muted: '#64748b',
        line: '#e2e8f0',
        bg: '#f8fafc',
        card: '#ffffff',
        accent: {
          DEFAULT: '#ea580c',
          soft: '#fff7ed',
          ring: '#fed7aa',
        },
        // Brand palette per CLAUDE.md.
        brand: {
          doordash: '#EB1700',
          wolt: '#009DE0',
          deliveroo: '#00CCBC',
        },
        // PoC warning color — the banner stripe.
        pocWarn: '#B00020',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Inter', 'sans-serif'],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        s1: '0 1px 2px rgba(15, 23, 42, 0.04)',
        s2: '0 4px 12px rgba(15, 23, 42, 0.06)',
        s3: '0 8px 32px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        DEFAULT: '10px',
        lg: '14px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
