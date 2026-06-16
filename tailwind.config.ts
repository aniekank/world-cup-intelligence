import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep purple-black base — lifted from the halftone artwork background
        terminal: {
          bg: '#0b0613',
          panel: '#150d22',
          elevated: '#1f1433',
          border: '#2e1f47',
          muted: '#9683b5',
          text: '#d9cdef',
          bright: '#f6f1ff',
        },
        // Accents pulled straight from "THE MANIFESTO" cover
        accent: {
          DEFAULT: '#1fe5c4', // electric teal (the face)
          dim: '#12a892',
          teal: '#1fe5c4',
          magenta: '#ff2e9a',
          amber: '#ff8a1e', // orange role (warnings / draws)
          orange: '#ff6a1e',
          red: '#ff2e6e', // hot pink-red
          lime: '#a8e020',
          blue: '#6d4dff', // indigo
          violet: '#9d3df0',
          purple: '#9d3df0',
          cyan: '#22e0d0',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(31,229,196,0.22), 0 8px 34px rgba(157,61,240,0.22)',
        'glow-magenta': '0 0 0 1px rgba(255,46,154,0.25), 0 8px 30px rgba(255,46,154,0.18)',
      },
      backgroundImage: {
        'manifesto':
          'linear-gradient(135deg, #ff2e9a 0%, #9d3df0 28%, #6d4dff 48%, #1fe5c4 72%, #a8e020 100%)',
      },
      keyframes: {
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        hueDrift: {
          '0%, 100%': { filter: 'hue-rotate(0deg)' },
          '50%': { filter: 'hue-rotate(18deg)' },
        },
      },
      animation: {
        pulseDot: 'pulseDot 1.4s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
        hueDrift: 'hueDrift 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
