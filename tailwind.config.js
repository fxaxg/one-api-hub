/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["!./node_modules", "./**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {}
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    function ({ addUtilities }) {
      const newUtilities = {
        ".scrollbar-hide": {
          /* IE and Edge */
          "-ms-overflow-style": "none",
          /* Firefox */
          "scrollbar-width": "none",
          /* Safari and Chrome */
          "&::-webkit-scrollbar": {
            display: "none"
          }
        }
      }
      addUtilities(newUtilities)
    }
  ]
}
