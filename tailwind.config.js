/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0a0a',
          elev: '#121212',
          card: '#1a1a1a',
          soft: '#222222',
        },
        stroke: {
          DEFAULT: '#2a2a2a',
          strong: '#3a3a3a',
        },
        accent: {
          DEFAULT: '#f5c542',
          soft: 'rgba(245, 197, 66, 0.08)',
          strong: '#ffd560',
        },
        fg: {
          DEFAULT: '#ededed',
          muted: '#8a8a8a',
          dim: '#5a5a5a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Source Serif Pro', 'Source Han Serif SC', 'Noto Serif SC', 'serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.3s ease-out',
        'pop': 'pop 0.2s cubic-bezier(.2,.8,.2,1)',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow': '0 0 40px rgba(245, 197, 66, 0.08)',
      },
    },
  },
  plugins: [],
}
