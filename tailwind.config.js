/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        bg: 'var(--color-bg)',
        'bg-alt': 'var(--color-bg-alt)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        main: ['"LXGW WenKai Screen"', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        'content': 'var(--max-width)',
      }
    },
  },
  plugins: [],
}
