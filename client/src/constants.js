// Model display names, badge colours, and @mention aliases
export const MODELS = {
  claude: {
    name: 'Claude',
    mention: '@claude',
    color: '#7C3AED',
    bgClass: 'bg-claude',
    borderClass: 'border-claude'
  },
  gpt4: {
    name: 'GPT-4',
    mention: '@gpt4',
    color: '#059669',
    bgClass: 'bg-gpt4',
    borderClass: 'border-gpt4'
  },
  gemini: {
    name: 'Gemini',
    mention: '@gemini',
    color: '#D97706',
    bgClass: 'bg-gemini',
    borderClass: 'border-gemini'
  },
  mistral: {
    name: 'Mistral',
    mention: '@mistral',
    color: '#DB2777',
    bgClass: 'bg-mistral',
    borderClass: 'border-mistral'
  }
};

export const MODEL_KEYS = Object.keys(MODELS);
