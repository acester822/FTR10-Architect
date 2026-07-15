import { ThemePreset, accentDerived } from '../theme-sync';

const neonMatrix: ThemePreset = {
  id: 'neon-matrix',
  name: 'Neon Matrix',
  description: 'Electric green on deep black — the default FTR10 experience.',
  colors: ['#34e411', '#9b59b6', '#3498db'],
  solidBg: '#070d07ff',
  overrides: {
    '--ftr10-body-font': "'Victor Mono', monospace",
    '--ftr10-heading-font': "'Orbitron', 'Victor Mono', monospace",
    '--ftr10-code-font': "'Victor Mono', monospace",
    '--ftr10-font-activitybar': "'Space Grotesk', monospace",
    '--ftr10-font-sidebar': "'Space Grotesk', monospace",
    '--ftr10-font-panel-bottom': "'Orbitron', monospace",
    '--ftr10-font-panel-top': "'JetBrains Mono', monospace",
    '--ftr10-font-auxiliarybar': "'Cartograph', monospace",
    '--ftr10-token-keyword': '#34e411',
    '--ftr10-token-string': '#a3e635',
    '--ftr10-token-number': '#fcd34d',
    '--ftr10-token-comment': '#1e4a1e',
    '--ftr10-token-function': '#3498db',
    '--ftr10-token-operator': '#22c55e',
    '--ftr10-token-boolean': '#f59e0b',
    '--ftr10-token-property': '#67e8f9',
    '--ftr10-token-tag': '#f472b6',
    '--ftr10-token-selector': '#9b59b6',
    ...accentDerived(52, 228, 17)
  }
};

export default neonMatrix;
