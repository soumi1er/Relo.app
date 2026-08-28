/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#20313a",
        paper: "#fbfaf6",
        canvas: "#f3efe7",
        teal: { DEFAULT: "#176f70", deep: "#123b46", soft: "#e1f0ed" },
        coral: { DEFAULT: "#d96b55", soft: "#fff0eb" },
        gold: { DEFAULT: "#c18a35", soft: "#f8f4ec" },
        line: "#e2ddd3",
      },
      fontFamily: { sans: ["DM Sans", "sans-serif"], display: ["Manrope", "sans-serif"] },
      boxShadow: { paper: "0 18px 50px rgba(32,49,58,.10)" },
      borderRadius: { card: "18px" },
    },
  },
  plugins: [],
};
