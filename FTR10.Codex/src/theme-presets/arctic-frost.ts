import { ThemePreset, accentDerived } from '../theme-sync';

const arcticFrost: ThemePreset = {
  id: 'arctic-frost',
  name: 'Arctic Frost',
  description: 'Cool ice-blue and silver with a clean, minimal feel.',
  colors: ['#7dd3fc', '#93c5fd', '#cbd5e1'],
  solidBg: '#07111aff',
  overrides: {
    '--ftr10-accent-1': '#7dd3fcd4',
    '--ftr10-accent-2': '#93c5fd',
    '--ftr10-accent-3': '#cbd5e1',
    '--ftr10-accent-4': '#bae6fd',
    '--ftr10-accent-5': '#e0f2fe',
    '--ftr10-cyan': '#a5f3fc',
    '--ftr10-purple': '#c4b5fd',
    '--ftr10-cursor': '#bae6fd',
    '--ftr10-tab-border-color': '#7dd3fc',
    '--ftr10-surface-1': '#7dd3fc45',
    '--ftr10-body-font': "'DM Mono', monospace",
    '--ftr10-heading-font': "'Exo 2', 'DM Mono', monospace",
    '--ftr10-code-font': "'JetBrains Mono', monospace",
    '--ftr10-font-activitybar': "'DM Mono', monospace",
    '--ftr10-font-sidebar': "'DM Mono', monospace",
    '--ftr10-font-panel-bottom': "'Exo 2', monospace",
    '--ftr10-font-panel-top': "'JetBrains Mono', monospace",
    '--ftr10-font-auxiliarybar': "'Cartograph', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #7dd3fc 0%, #bae6fd 40%, #93c5fd 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #0a1520 0%, #7dd3fc 25%, #bae6fd 50%, #93c5fd 75%, #0a1520 100%)',
    '--ftr10-token-keyword': '#93c5fd',
    '--ftr10-token-string': '#86efac',
    '--ftr10-token-number': '#fdba74',
    '--ftr10-token-comment': '#64748b',
    '--ftr10-token-function': '#bae6fd',
    '--ftr10-token-operator': '#a5f3fc',
    '--ftr10-token-boolean': '#fcd34d',
    '--ftr10-token-property': '#e0f2fe',
    '--ftr10-token-tag': '#fecdd3',
    '--ftr10-token-selector': '#a5b4fc',
    ...accentDerived(125, 211, 252)
  }
};

export default arcticFrost;
