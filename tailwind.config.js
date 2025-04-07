/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'soft-off-white': '#FAFAF9',
        'light-beige': '#F2EFEA',
        'pale-gray': '#E7E7E7',
        'muted-sage-green': '#D4E2D4',
        'cool-gray-green': '#A8B9AE',
        'mist-blue': '#C9D8D3', // Secondary Accent
        'charcoal': '#4A4A4A', // Secondary Accent (for text)
        'pebble-gray': '#DADADA', // Secondary Accent
      },
    },
  },
  plugins: [],
}