/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        bg: 'var(--color-bg)',
        'bg-alt': 'var(--color-bg-alt)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'bg-secondary-hover': 'var(--color-bg-secondary-hover)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        main: ['"LXGW WenKai Screen"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        'content': 'var(--max-width)',
      },
      keyframes: {
        'slide-down': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'slide-down': 'slide-down 0.2s ease-out',
        'skeleton-pulse': 'skeleton-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
