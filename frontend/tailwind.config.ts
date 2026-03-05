/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        "public-sans": ['"Public Sans"', "sans-serif"],
        "ins-sans": ['"Instrument Sans"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
