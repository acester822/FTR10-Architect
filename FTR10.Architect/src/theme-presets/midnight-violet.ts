import { ThemePreset, accentDerived } from '../theme-sync';

const midnightViolet: ThemePreset = {
  id: 'midnight-violet',
  name: 'Midnight Violet',
  description: 'Rich purple accents with pink and indigo highlights.',
  colors: ['#a855f7', '#ec4899', '#6366f1'],
  solidBg: '#0d0a1aff',
  overrides: {
    '--ftr10-accent-1': '#a855f7d4',
    '--ftr10-accent-2': '#ec4899',
    '--ftr10-accent-3': '#6366f1',
    '--ftr10-accent-4': '#8b5cf6',
    '--ftr10-accent-5': '#c084fc',
    '--ftr10-cyan': '#c084fc',
    '--ftr10-purple': '#a855f7',
    '--ftr10-cursor': '#c084fc',
    '--ftr10-tab-border-color': '#a855f7',
    '--ftr10-surface-1': '#a855f745',
    '--ftr10-body-font': "'Recursive', monospace",
    '--ftr10-heading-font': "'Oxanium', 'Recursive', monospace",
    '--ftr10-code-font': "'Fira Code', monospace",
    '--ftr10-font-activitybar': "'Recursive', monospace",
    '--ftr10-font-sidebar': "'Recursive', monospace",
    '--ftr10-font-panel-bottom': "'Oxanium', monospace",
    '--ftr10-font-panel-top': "'Fira Code', monospace",
    '--ftr10-font-auxiliarybar': "'Recursive', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #a855f7 0%, #c084fc 40%, #ec4899 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #1a0a2e 0%, #a855f7 25%, #c084fc 50%, #ec4899 75%, #1a0a2e 100%)',
    '--ftr10-token-keyword': '#c084fc',
    '--ftr10-token-string': '#a7f3d0',
    '--ftr10-token-number': '#fb923c',
    '--ftr10-token-comment': '#4a3666',
    '--ftr10-token-function': '#818cf8',
    '--ftr10-token-operator': '#c4b5fd',
    '--ftr10-token-boolean': '#f472b6',
    '--ftr10-token-property': '#e879f9',
    '--ftr10-token-tag': '#ec4899',
    '--ftr10-token-selector': '#a855f7',
    ...accentDerived(168, 85, 247)
  }
};

export default midnightViolet;
