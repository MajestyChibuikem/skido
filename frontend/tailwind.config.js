/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'skido-dark': '#1a472a',
        'skido-light': '#65E4CF',
        'skido-dark-accent': '#056363',
        'skido-bg-dark': '#0a0a0a',
        'skido-bg-light': '#e4e4e7',
      },
    },
  },
  plugins: [],
};
