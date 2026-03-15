/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // CSS-variable backed — update automatically on theme toggle
        bg:               'var(--color-bg)',
        surface:          'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        'ai-bg':          'var(--color-ai-bg)',
        border:           'var(--color-border)',
        // Static accent + model badges
        accent:  '#1A56DB',
        claude:  '#7C3AED',
        gpt4:    '#059669',
        gemini:  '#D97706',
        mistral: '#DB2777'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      fontSize: {
        message:   '0.875rem',
        sidebar:   '0.75rem',
        timestamp: '0.6875rem'
      }
    }
  },
  plugins: []
};
