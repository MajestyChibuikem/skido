/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'agrocare-dark': '#1a472a',
        'agrocare-light': '#65E4CF',
        'agrocare-dark-accent': '#056363',
        'agrocare-bg-dark': '#0a0a0a',
        'agrocare-bg-light': '#e4e4e7',
      },
    },
  },
  plugins: [],
};
