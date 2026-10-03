/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#181614", // Deep espresso charcoal
        surface: "#24201D",     // Warm graphite for cards
        border: "#2D2824",      // Secondary surfaces
        primary: "#D6A84F",     // Muted gold
        primaryHover: "#E6B85F",
        ai: "#C98B5B",          // Copper for AI
        textMain: "#F3EDE3",    // Warm ivory
        textMuted: "#AFA49A",   // Warm gray
        critical: "#B64A4A",    // Muted red
        high: "#C06132",        // Burnt orange
        medium: "#C19B4C",      // Amber
        low: "#7D937C"          // Muted sage
      }
    },
  },
  plugins: [],
}
