import { ThemePreset, accentDerived } from '../theme-sync';

const monochrome: ThemePreset = {
  id: 'monochrome',
  name: 'Monochrome',
  description: 'Silver and slate — minimal, distraction-free tones.',
  colors: ['#94a3b8', '#64748b', '#475569'],
  solidBg: '#0e1014ff',
  overrides: {
    '--ftr10-accent-1': '#94a3b8d4',
    '--ftr10-accent-2': '#64748b',
    '--ftr10-accent-3': '#475569',
    '--ftr10-accent-4': '#cbd5e1',
    '--ftr10-accent-5': '#e2e8f0',
    '--ftr10-cyan': '#cbd5e1',
    '--ftr10-purple': '#94a3b8',
    '--ftr10-cursor': '#cbd5e1',
    '--ftr10-tab-border-color': '#94a3b8',
    '--ftr10-surface-1': '#94a3b845',
    '--ftr10-body-font': "'DM Mono', monospace",
    '--ftr10-heading-font': "'Space Grotesk', 'DM Mono', monospace",
    '--ftr10-code-font': "'DM Mono', monospace",
    '--ftr10-font-activitybar': "'Space Grotesk', monospace",
    '--ftr10-font-sidebar': "'Space Grotesk', monospace",
    '--ftr10-font-panel-bottom': "'Space Grotesk', monospace",
    '--ftr10-font-panel-top': "'DM Mono', monospace",
    '--ftr10-font-auxiliarybar': "'DM Mono', monospace",
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #94a3b8 0%, #cbd5e1 40%, #64748b 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #0f1218 0%, #94a3b8 25%, #cbd5e1 50%, #64748b 75%, #0f1218 100%)',
    '--ftr10-token-keyword': '#cbd5e1',
    '--ftr10-token-string': '#86efac',
    '--ftr10-token-number': '#fdba74',
    '--ftr10-token-comment': '#475569',
    '--ftr10-token-function': '#93c5fd',
    '--ftr10-token-operator': '#e2e8f0',
    '--ftr10-token-boolean': '#fcd34d',
    '--ftr10-token-property': '#f1f5f9',
    '--ftr10-token-tag': '#fecdd3',
    '--ftr10-token-selector': '#a5b4fc',
    ...accentDerived(148, 163, 184)
  }
};

export default monochrome;
