/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // landscape phones: very little vertical room
        short: { raw: '(orientation: landscape) and (max-height: 500px)' },
      },
    },
  },
  plugins: [],
}
