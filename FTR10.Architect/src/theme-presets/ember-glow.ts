import { ThemePreset, accentDerived } from '../theme-sync';

const emberGlow: ThemePreset = {
  id: 'ember-glow',
  name: 'Ember Glow',
  description: 'Deep reds and orange with a smoldering warmth.',
  colors: ['#ef4444', '#f97316', '#eab308'],
  solidBg: '#120404ff',
  overrides: {
    '--ftr10-accent-1': '#ef4444d4',
    '--ftr10-accent-2': '#f97316',
    '--ftr10-accent-3': '#eab308',
    '--ftr10-accent-4': '#f87171',
    '--ftr10-accent-5': '#fca5a5',
    '--ftr10-body-font': "'Victor Mono', monospace",
    '--ftr10-heading-font': "'Orbitron', 'Victor Mono', monospace",
    '--ftr10-code-font': "'Victor Mono', monospace",
    '--ftr10-font-activitybar': "'Space Grotesk', monospace",
    '--ftr10-font-sidebar': "'Space Grotesk', monospace",
    '--ftr10-font-panel-bottom': "'Orbitron', monospace",
    '--ftr10-font-panel-top': "'Jetbrains Mono', monospace",
    '--ftr10-font-auxiliarybar': "'Cartograph', monospace",
    '--ftr10-cyan': '#f97316',
    '--ftr10-purple': '#f87171',
    '--ftr10-cursor': '#f87171',
    '--ftr10-tab-border-color': '#ef4444',
    '--ftr10-surface-1': '#ef444445',
    '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
    '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #ef4444 0%, #f87171 40%, #f97316 70%, transparent 100%)',
    '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #1a0505 0%, #ef4444 25%, #f87171 50%, #f97316 75%, #1a0505 100%)',
    '--ftr10-token-keyword': '#fca5a5',
    '--ftr10-token-string': '#86efac',
    '--ftr10-token-number': '#fcd34d',
    '--ftr10-token-comment': '#78716c',
    '--ftr10-token-function': '#fdba74',
    '--ftr10-token-operator': '#fed7aa',
    '--ftr10-token-boolean': '#f97316',
    '--ftr10-token-property': '#fef08a',
    '--ftr10-token-tag': '#fca5a5',
    '--ftr10-token-selector': '#feb2b2',
    ...accentDerived(239, 68, 68)
  }
};

export default emberGlow;
