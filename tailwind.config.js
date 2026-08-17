/** @type {import('tailwindcss').Config} */
export default {
  // Specify all files where Tailwind classes might be used
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}