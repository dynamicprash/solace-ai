/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          100: '#e4ede4',
          200: '#c5d9c4',
          300: '#9abf99',
          400: '#6a9e69',
          500: '#4d8050',
          600: '#3a6640',
          700: '#2e5133',
          800: '#263f2a',
          900: '#1e3121',
        },
        stone: {
          100: '#f2f0ec',
          200: '#e4e0d8',
          300: '#cdc8bc',
          400: '#b0a898',
          500: '#958c7a',
          600: '#786e5c',
          700: '#60574a',
          800: '#4a4238',
        },
        cream: '#f7f4ee',
        'warm-white': '#fdfcf9',
        sev: {
          high: '#c0444a',
          med: '#c9843a',
          low: '#6a9e69',
        }
      },
      fontFamily: {
        display: ['DM Serif Display', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        xl: '32px',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        }
      },
      animation: {
        fadeUp: 'fadeUp 0.5s ease both',
        fadeIn: 'fadeIn 0.3s ease both',
        pulse: 'pulse 1.2s ease-in-out infinite',
        blink: 'blink 0.8s step-end infinite',
        shimmer: 'shimmer 1.5s infinite'
      },
      boxShadow: {
        'card': '0 8px 32px rgba(30, 49, 33, 0.12)',
        'tab': '0 1px 4px rgba(30, 49, 33, 0.08)',
        'input-focus': '0 0 0 3px rgba(106, 158, 105, 0.12)',
      },
    }
  },
  plugins: [],
}
