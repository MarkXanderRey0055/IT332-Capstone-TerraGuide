/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#ecf3ef', 100: '#d0e2d7', 200: '#a5c7b3', 300: '#75a68a',
          400: '#508769', 500: '#386b4f', 600: '#2a543d', 700: '#234432',
          800: '#1d372a', 900: '#192f24', 950: '#0e1b15',
        },
        sage: {
          50: '#f4f7f4', 100: '#e3eae2', 200: '#ca969c', 300: '#a3b899',
          400: '#839d77', 500: '#66815b', 600: '#4f6645', 700: '#3f5138',
          800: '#34422f', 900: '#2c3728',
        },
        moss: { 500: '#4a5d4e', 600: '#3c4d40' },
        cream: { 50: '#fdfbf7', 100: '#f7f4eb' }
      },
    },
  },
  plugins: [],
}