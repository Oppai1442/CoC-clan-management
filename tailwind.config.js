/** @type {import('tailwindcss').Config} */

import scrollbar from 'tailwind-scrollbar';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [
    scrollbar
  ],
}
