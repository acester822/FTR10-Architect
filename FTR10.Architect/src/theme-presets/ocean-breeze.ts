import { ThemePreset, accentDerived } from '../theme-sync';

const oceanBreeze: ThemePreset = {
  id: 'ocean-breeze',
  name: 'Ocean Breeze',
  description: 'Cool cyan and blue tones inspired by deep water.',
  colors: ['#06b6d4', '#3b82f6', '#14b8a6'],
  solidBg: '#071218ff',
  overrides: {
    '--ftr10-accent-1': '#06b6d4d4',
    '--ftr10-accent-2': '#3b82f6',
    '--ftr10-accent-3': '#14b8a6',
    '--ftr10-accent-4': '#22d3ee',
    '--ftr10-accent-5': '#67e8f9',
    '--ftr10-cyan': '#22d3ee',
    '--ftr10-purple': '#8b5cf6',
    '--ftr10-cursor': '#22d3ee',
    '--ftr10-tab-border-color': '#06b6d4',
    '--ftr10-surface-1': '#06b6d445',
    '--ftr10-body-font': "'Space Grotesk', monospace",
    '--ftr10-heading-font': "'Exo 2', 'Space Grotesk', monospace",
    '--ftr10-code-font': "'JetBrains Mono', monospace",
    '--ftr10-font-activitybar': "'Space Grotesk', monospace",
    '--ftr10-font-sidebar': "'Space Grotesk', monospace",
    '--ftr10-font-panel-bottom': "'Exo 2', monospace",
    '--ftr10-font-panel-top': "'JetBrains Mono', monospace",
    '--ftr10-font-auxiliarybar': "'Cartograph', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #06b6d4 0%, #22d3ee 40%, #3b82f6 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #0a1628 0%, #06b6d4 25%, #22d3ee 50%, #3b82f6 75%, #0a1628 100%)',
    '--ftr10-token-keyword': '#22d3ee',
    '--ftr10-token-string': '#5eead4',
    '--ftr10-token-number': '#fde68a',
    '--ftr10-token-comment': '#1e4a5c',
    '--ftr10-token-function': '#60a5fa',
    '--ftr10-token-operator': '#67e8f9',
    '--ftr10-token-boolean': '#f59e0b',
    '--ftr10-token-property': '#a5f3fc',
    '--ftr10-token-tag': '#f9a8d4',
    '--ftr10-token-selector': '#7c3aed',
    ...accentDerived(6, 182, 212)
  }
};

export default oceanBreeze;
