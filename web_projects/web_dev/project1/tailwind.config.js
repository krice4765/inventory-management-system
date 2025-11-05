/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Inter"', '"Noto Sans JP"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'display': ['"Plus Jakarta Sans"', '"Noto Sans JP"', 'ui-sans-serif', 'sans-serif'],
        'inter': ['"Inter"', 'ui-sans-serif', 'sans-serif'],
        'jakarta': ['"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
        'noto': ['"Noto Sans JP"', 'ui-sans-serif', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
