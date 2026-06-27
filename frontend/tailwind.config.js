/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta quente — tomate, terracota, creme
        cream: {
          50: '#fffaf2',
          100: '#fdf2e0',
          200: '#f8e0bd',
        },
        tomato: {
          50: '#fff3f0',
          100: '#ffd9d1',
          200: '#fdbeaf',
          300: '#fa9a82',
          400: '#f57558',
          500: '#e84f31',
          600: '#cc3a1c',
          700: '#a52a13',
        },
        ember: {
          500: '#d97706',
          600: '#b35806',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 4px 18px -8px rgba(204, 58, 28, 0.18)',
      },
    },
  },
  plugins: [],
};
