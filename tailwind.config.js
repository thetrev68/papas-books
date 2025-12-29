import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9', // Sky 500 - Clear Blue
          600: '#0284c7', // Sky 600
          700: '#0369a1', // Sky 700 - High Contrast Text
          900: '#0c4a6e', // Sky 900
        },
        success: {
          100: '#dcfce7',
          700: '#15803d',
        },
        danger: {
          100: '#fee2e2',
          700: '#b91c1c',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0', // Borders
          800: '#1e293b', // Primary Text
          900: '#0f172a', // Headings
        }
      },
      fontSize: {
        'base': ['1.125rem', '1.75rem'], // 18px body
        'lg': ['1.25rem', '1.75rem'], // 20px
        'xl': ['1.5rem', '2rem'], // 24px headings
        '2xl': ['1.875rem', '2.25rem'], // 30px
      },
      spacing: {
        '18': '4.5rem', // Large touch targets
      }
    },
  },
  plugins: [
    forms,
  ],
}
