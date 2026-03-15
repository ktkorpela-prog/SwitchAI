/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // SwitchAI design palette
        bg: '#0F1117',
        surface: '#1A1B23',
        'surface-raised': '#22243A',
        accent: '#1A56DB',
        'ai-bg': '#1E2235',
        border: '#2D2F45',
        // Model badge colours
        claude: '#7C3AED',
        gpt4: '#059669',
        gemini: '#D97706',
        mistral: '#DB2777'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      fontSize: {
        message: '0.875rem',   // 14px
        sidebar: '0.75rem',    // 12px
        timestamp: '0.6875rem' // 11px
      }
    }
  },
  plugins: []
};
