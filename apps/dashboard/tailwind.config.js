/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'canvas-cream': '#F3F0EE',
        'lifted-cream': '#FCFBFA',
        'ink-black': '#141413',
        'signal-orange': '#CF4500',
        'light-signal-orange': '#F37338',
      },
      borderRadius: {
        'stadium': '40px',
        'pill': '999px',
      },
    },
  },
  plugins: [],
}
