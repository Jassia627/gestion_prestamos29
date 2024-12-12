/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FFD100",     // Amarillo del logo SDLG
        secondary: "#000000",   // Negro del logo SDLG
        accent: "#FF0000",      // Rojo del logo SDLG
      }
    },
  },
  plugins: [],
}