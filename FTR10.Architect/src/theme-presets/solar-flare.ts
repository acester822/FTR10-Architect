import { ThemePreset, accentDerived } from '../theme-sync';

const solarFlare: ThemePreset = {
  id: 'solar-flare',
  name: 'Solar Flare',
  description: 'Warm amber and orange with fiery highlights.',
  colors: ['#f59e0b', '#f97316', '#ef4444'],
  solidBg: '#140d01ff',
  overrides: {
    '--ftr10-accent-1': '#f59e0bd4',
    '--ftr10-accent-2': '#f97316',
    '--ftr10-accent-3': '#ef4444',
    '--ftr10-accent-4': '#fbbf24',
    '--ftr10-accent-5': '#fcd34d',
    '--ftr10-cyan': '#fbbf24',
    '--ftr10-purple': '#f97316',
    '--ftr10-cursor': '#fbbf24',
    '--ftr10-tab-border-color': '#f59e0b',
    '--ftr10-surface-1': '#f59e0b45',
    '--ftr10-body-font': "'Rajdhani', monospace",
    '--ftr10-heading-font': "'Orbitron', 'Rajdhani', monospace",
    '--ftr10-code-font': "'Cartograph', monospace",
    '--ftr10-font-activitybar': "'Rajdhani', monospace",
    '--ftr10-font-sidebar': "'Rajdhani', monospace",
    '--ftr10-font-panel-bottom': "'Orbitron', monospace",
    '--ftr10-font-panel-top': "'Cartograph', monospace",
    '--ftr10-font-auxiliarybar': "'Space Grotesk', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 40%, #f97316 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #1a0f00 0%, #f59e0b 25%, #fbbf24 50%, #f97316 75%, #1a0f00 100%)',
    '--ftr10-token-keyword': '#fbbf24',
    '--ftr10-token-string': '#86efac',
    '--ftr10-token-number': '#fb923c',
    '--ftr10-token-comment': '#78716c',
    '--ftr10-token-function': '#fdba74',
    '--ftr10-token-operator': '#fde68a',
    '--ftr10-token-boolean': '#ef4444',
    '--ftr10-token-property': '#fef08a',
    '--ftr10-token-tag': '#fca5a5',
    '--ftr10-token-selector': '#fed7aa',
    ...accentDerived(245, 158, 11)
  }
};

export default solarFlare;
