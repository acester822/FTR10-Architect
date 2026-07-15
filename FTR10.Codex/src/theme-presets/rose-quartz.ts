import { ThemePreset, accentDerived } from '../theme-sync';

const roseQuartz: ThemePreset = {
  id: 'rose-quartz',
  name: 'Rose Quartz',
  description: 'Soft pinks and rose tones with lavender accents.',
  colors: ['#f472b6', '#fb7185', '#c084fc'],
  solidBg: '#14080fff',
  overrides: {
    '--ftr10-accent-1': '#f472b6d4',
    '--ftr10-accent-2': '#fb7185',
    '--ftr10-accent-3': '#c084fc',
    '--ftr10-accent-4': '#f9a8d4',
    '--ftr10-accent-5': '#fda4af',
    '--ftr10-cyan': '#f9a8d4',
    '--ftr10-purple': '#c084fc',
    '--ftr10-cursor': '#f9a8d4',
    '--ftr10-tab-border-color': '#f472b6',
    '--ftr10-surface-1': '#f472b645',
    '--ftr10-body-font': "'Space Grotesk', monospace",
    '--ftr10-heading-font': "'Recursive', 'Space Grotesk', monospace",
    '--ftr10-code-font': "'Fira Code', monospace",
    '--ftr10-font-activitybar': "'Space Grotesk', monospace",
    '--ftr10-font-sidebar': "'Space Grotesk', monospace",
    '--ftr10-font-panel-bottom': "'Recursive', monospace",
    '--ftr10-font-panel-top': "'Fira Code', monospace",
    '--ftr10-font-auxiliarybar': "'Space Grotesk', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #f472b6 0%, #f9a8d4 40%, #fb7185 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #1a0a14 0%, #f472b6 25%, #f9a8d4 50%, #fb7185 75%, #1a0a14 100%)',
    '--ftr10-token-keyword': '#f9a8d4',
    '--ftr10-token-string': '#86efac',
    '--ftr10-token-number': '#fdba74',
    '--ftr10-token-comment': '#9ca3af',
    '--ftr10-token-function': '#c4b5fd',
    '--ftr10-token-operator': '#fbcfe8',
    '--ftr10-token-boolean': '#fb923c',
    '--ftr10-token-property': '#fde68a',
    '--ftr10-token-tag': '#fda4af',
    '--ftr10-token-selector': '#f9a8d4',
    ...accentDerived(244, 114, 182)
  }
};

export default roseQuartz;
