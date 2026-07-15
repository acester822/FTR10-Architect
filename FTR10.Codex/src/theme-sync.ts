import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';

// ═══════════════════════════════════════════════════════════════════
// Interfaces
// ═══════════════════════════════════════════════════════════════════

interface Section {
  name: string;
  keys: string[];
}

interface ArchitectSession {
  id: string;
  name: string;
  baseHue: number;
  harmony: string;
  swatchOverrides: Record<string, string>;
  savedColors: string[];
  bgEffect?: string;
  thpaceEnabled?: string;
  varOverrides?: Record<string, string>;  // extra --ftr10-* vars edited in the Vars panel, stored as a diff vs. the palette-derived set
  createdAt: number;
  updatedAt: number;
  isBase?: boolean;            // marks a seed Base card derived from a static preset
  basePresetId?: string;       // original preset id for reset capability
}

// ── helpers for Base session seeding ────────────────────────────────────────
function hexToHue(hex: string): number {
  try {
    const h = hex.replace('#','').trim();
    if (h.length < 6) {return 0;}
    const r = parseInt(h.slice(0,2),16)/255;
    const g = parseInt(h.slice(2,4),16)/255;
    const b = parseInt(h.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    if (max === min) {return 0;}
    const d = max - min;
    let hue = 0;
    switch(max){
      case r: hue = (g - b)/d + (g < b ? 6 : 0); break;
      case g: hue = (b - r)/d + 2; break;
      case b: hue = (r - g)/d + 4; break;
    }
    return Math.round(hue*60) % 360;
  } catch { return 0; }
}
function stripAlpha(hexOrCss: string): string {
  if (!hexOrCss) {return '#000000';}
  const s = hexOrCss.trim();
  // #RRGGBBAA → #RRGGBB
  if (/^#[0-9a-fA-F]{8}$/.test(s)) {return s.slice(0,7);}
  if (/^#[0-9a-fA-F]{6}$/.test(s)) {return s;}
  // try to extract hex from color-mix / other
  const m = s.match(/#[0-9a-fA-F]{6,8}/);
  if (m) {return m[0].slice(0,7);}
  return '#000000';
}
function presetToBaseSession(preset: ThemePreset): ArchitectSession {
  const c1 = preset.colors[0] || '#7b68ee';
  const c2 = preset.colors[1] || '#00d4ff';
  const c3 = preset.colors[2] || '#ff6bca';
  // Try to pull c4-c6 from preset overrides, else synthesize
  const o = preset.overrides || {};
  const c4 = stripAlpha(o['--ftr10-accent-4'] || o['--ftr10-cursor'] || c1);
  const c5raw = o['--ftr10-surface-1'] || '#a4d6b130';
  const c6raw = o['--ftr10-surface-2'] || '#c8bee418';
  const c5 = stripAlpha(c5raw);
  const c6 = stripAlpha(c6raw);
  return {
    id: `base-${preset.id}`,
    name: `${preset.name} (Base)`,
    baseHue: hexToHue(c1),
    harmony: 'analogous',
    swatchOverrides: {},
    savedColors: [c1,c2,c3,c4,c5,c6],
    bgEffect: 'nebula',
    thpaceEnabled: 'true',
    varOverrides: { ...o },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isBase: true,
    basePresetId: preset.id
  };
}
// Legacy helper kept for compatibility (now delegates to presetToBaseSession)
function presetToSession(preset: ThemePreset): ArchitectSession {
  return presetToBaseSession(preset);
}

function ensureBaseSessions(): boolean {
  let changed = false;
  // Create a base card for each static preset if not already present
  for (let idx = 0; idx < THEME_PRESETS.length; idx++) {
    const preset = THEME_PRESETS[idx];
    const baseId = `base-${preset.id}`;
    if (themeConfig.architectSessions[baseId]) {continue;}
    const session = presetToBaseSession(preset);
    // Stagger createdAt so original preset order is preserved (oldest first)
    session.createdAt = Date.now() - (THEME_PRESETS.length - idx) * 10000;
    session.updatedAt = session.createdAt;
    themeConfig.architectSessions[baseId] = session;
    changed = true;
  }
  return changed;
}

function resetBaseSession(sessionId: string): void {
  const existing = themeConfig.architectSessions[sessionId];
  if (!existing?.isBase || !existing.basePresetId) {return;}
  const preset = THEME_PRESETS.find(p => p.id === existing.basePresetId);
  if (!preset) {return;}
  const fresh = presetToBaseSession(preset);
  // Preserve id and isBase flags but reset content to factory
  fresh.createdAt = existing.createdAt;
  fresh.updatedAt = Date.now();
  themeConfig.architectSessions[sessionId] = fresh;
  persistThemeConfig();
  sidebarProvider?.syncSessions();
  // If that base card is currently active, re-apply it
  if (themeConfig.activePreset === `arch-${sessionId}`) {
    applyArchitectSession(sessionId);
  }
  vscode.window.showInformationMessage(`Base card "${fresh.name}" reset to defaults.`);
}

interface ThemeConfig {
  sections: Section[];
  values: Record<string, string>;
  cssImports: string[];
  customCss: string;
  activePreset?: string;
  presetCustomizations: Record<string, Record<string, string>>;
  presetBackgroundMode: Record<string, 'effects' | 'solid'>;
  architectSessions: Record<string, ArchitectSession>;
}

interface RawThemeJson {
  ftr10Variables?: { sections?: Section[]; values?: Record<string, string> } | Record<string, string>;
  cssImports?: string[];
  customCss?: string;
  lastModified?: number;
  activePreset?: string;
  presetCustomizations?: Record<string, Record<string, string>>;
  presetBackgroundMode?: Record<string, 'effects' | 'solid'>;
  architectSessions?: Record<string, ArchitectSession>;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: [string, string, string];
  overrides: Record<string, string>;
  solidBg?: string;  // opaque bg used when this preset is switched to solid mode
}

// ═══════════════════════════════════════════════════════════════════
// Popular keys — the subset shown in simple editor mode
// ═══════════════════════════════════════════════════════════════════

const SIMPLE_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: 'Palette',
    keys: [
      '--ftr10-accent-1', '--ftr10-accent-2', '--ftr10-accent-3', '--ftr10-accent-4',
      '--ftr10-surface-1', '--ftr10-surface-2'
    ]
  },
  {
    label: 'Backgrounds',
    keys: [
      '--ftr10-bg', '--ftr10-bg-editor', '--ftr10-bg-image-panels', '--ftr10-bg-effect'
    ]
  },
  {
    label: 'Text',
    keys: ['--ftr10-text', '--ftr10-text-muted']
  },
  {
    label: 'UI',
    keys: [
      '--ftr10-cursor', '--ftr10-tab-border-color',
      '--ftr10-glass-bg', '--ftr10-glass-bg-menu'
    ]
  },
  {
    label: 'Status Colors',
    keys: ['--ftr10-success', '--ftr10-error', '--ftr10-warning', '--ftr10-info']
  },
  {
    label: 'Semantic',
    keys: ['--ftr10-purple', '--ftr10-cyan']
  },
  {
    label: 'Typography',
    keys: [
      '--ftr10-body-font', '--ftr10-heading-font', '--ftr10-code-font',
      '--ftr10-font-activitybar', '--ftr10-font-sidebar',
      '--ftr10-font-panel-bottom', '--ftr10-font-panel-top', '--ftr10-font-auxiliarybar'
    ]
  },
  {
    label: 'Shape',
    keys: ['--ftr10-radius-md', '--ftr10-radius-lg', '--ftr10-corner-shape']
  },
  {
    label: 'Pane Opacity',
    keys: [
      '--ftr10-opacity-activitybar', '--ftr10-opacity-sidebar',
      '--ftr10-opacity-panel-bottom', '--ftr10-opacity-panel-top',
      '--ftr10-opacity-auxiliarybar'
    ]
  },
  {
    label: 'Syntax Tokens',
    keys: [
      '--ftr10-token-keyword', '--ftr10-token-string', '--ftr10-token-number',
      '--ftr10-token-comment', '--ftr10-token-function', '--ftr10-token-boolean',
      '--ftr10-token-storage', '--ftr10-token-type', '--ftr10-token-class',
      '--ftr10-token-punctuation', '--ftr10-token-variable', '--ftr10-token-property',
      '--ftr10-token-operator', '--ftr10-token-tag', '--ftr10-token-selector'
    ]
  }
];


// ═══════════════════════════════════════════════════════════════════
// Theme Presets
// ═══════════════════════════════════════════════════════════════════

export function accentDerived(r: number, g: number, b: number): Record<string, string> {
  const x = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  const h = (a: number) => `#${x(r)}${x(g)}${x(b)}${x(Math.round(a * 255))}`;
  const bk = (a: number) => `#000000${x(Math.round(a * 255))}`;
  return {
    '--ftr10-glass-bg-hover': h(0.07),
    '--ftr10-glass-bg-active': h(0.12),
    '--ftr10-glass-bg-breadcrumb-hover': h(0.06),
    '--ftr10-border-base': h(0.10),
    '--ftr10-border-base-70': h(0.07),
    '--ftr10-border-subtle': h(0.05),
    '--ftr10-glass-border-top': `2px solid ${h(0.18)}`,
    '--ftr10-glass-border-side': `2px solid ${h(0.08)}`,
    '--ftr10-glass-outline-soft': `1px solid ${h(0.10)}`,
    '--ftr10-glass-border-top-soft': `1px solid ${h(0.10)}`,
    '--ftr10-glass-border-side-soft': `1px solid ${h(0.05)}`,
    '--ftr10-shadow-focus': h(0.40),
    '--ftr10-shadow-popup': `0 8px 32px ${bk(0.50)}, 0 0 0 1px ${h(0.10)}`,
    '--ftr10-shadow-selection': `0 0 0 1px ${h(0.30)}, 0 0 20px ${h(0.15)}, 0 0 40px ${h(0.08)}`,
    '--ftr10-shadow-selected-focused': `1px 1px 1px 1px ${h(0.35)}, 1px 1px 7px 0px ${h(0.55)}`,
    '--ftr10-shadow-inner-outline': `inset 0 0 0 1px ${h(0.08)}`,
    '--ftr10-inset-light-edges': `inset 0 1px 0 0 ${h(0.14)}, inset 1px 0 0 0 ${h(0.07)}, inset 0 -1px 0 0 ${bk(0.08)}, inset -1px 0 0 0 ${bk(0.04)}`,
    '--ftr10-inset-light-shadow': `inset 0 1px 2px 0 ${h(0.06)}`,
    '--ftr10-editor-current-line-bg': h(0.04),
    '--ftr10-highlight': `color-mix(in oklch, var(--ftr10-accent-1) 48%, var(--ftr10-bg))`,
    '--ftr10-activitybar-hover-bg': h(0.12),
    '--ftr10-activitybar-hover-outer-glow': `0 0 20px ${h(0.30)}`,
    '--ftr10-activitybar-hover-inner-glow': `inset 0 0 15px ${h(0.15)}`,
    '--ftr10-accent-shadow-red': `1px 1px 1px 1px ${h(0.35)}`,
    '--ftr10-accent-shadow-red-strong': `1px 1px 7px 0px ${h(0.70)}`,
    '--ftr10-text-shadow-hover': `0 0 5px ${h(0.40)}`,
  };
}


// ═══════════════════════════════════════════════════════════════════
// Architect session → derived preset
// ═══════════════════════════════════════════════════════════════════

/**
 * Pure function: given a saved ArchitectSession, returns a ThemePreset
 * with all --ftr10-* overrides derived from the session's palette.
 */
function _hex2rgbaTs(hex: string, a: number): string {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Given a hue (from accent-1) and a target lightness/saturation, produce a
 * desaturated muted comment color that is always readable on dark backgrounds.
 * Strategy: take accent-1's hue, heavily desaturate, set lightness to ~42%.
 */
/** Linear interpolate between two hex colors. t=0 → a, t=1 → b. */
function _hexLerp(a: string, b: string, t: number): string {
  const pr = (h: string) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [ar,ag,ab] = pr(a), [br,bg,bb] = pr(b);
  const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
  return '#' + [clamp(ar+(br-ar)*t), clamp(ag+(bg-ag)*t), clamp(ab+(bb-ab)*t)].map(v => v.toString(16).padStart(2,'0')).join('');
}

function _commentColorFromAccent(hexAccent: string): string {
  const r = parseInt(hexAccent.slice(1,3),16),
        g = parseInt(hexAccent.slice(3,5),16),
        b = parseInt(hexAccent.slice(5,7),16);
  const rn = r/255, gn = g/255, bn = b/255;
  const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) {h = 60*(((gn-bn)/d)%6);}
    else if (max === gn) {h = 60*(((bn-rn)/d)+2);}
    else {h = 60*(((rn-gn)/d)+4);}
    if (h < 0) {h += 360;}
  }
  // Muted: low saturation, mid lightness
  const s = 28, l = 52;
  const an = s/100 * Math.min(l/100, 1 - l/100);
  const f = (n: number) => {
    const k = (n + h/30) % 12;
    return Math.round(255 * (l/100 - an * Math.max(-1, Math.min(k-3, 9-k, 1))));
  };
  return '#' + [f(0),f(8),f(4)].map(v => v.toString(16).padStart(2,'0')).join('');
}

export function deriveCodexPreset(session: ArchitectSession): ThemePreset {
  const colors = session.savedColors;
  if (!colors || colors.length < 6) {
    return {
      id: `arch-${session.id}`,
      name: session.name,
      description: session.harmony,
      colors: [colors?.[0] || '#7b68ee', colors?.[1] || '#00d4ff', colors?.[2] || '#ff6bca'],
      overrides: {}
    };
  }
  const [c1, c2, c3, c4, c5, c6] = colors;
  const bgAmbient = [
    `radial-gradient(ellipse 70% 60% at 20% 30%, ${_hex2rgbaTs(c1,0.16)} 0%, transparent 65%)`,
    `radial-gradient(ellipse 60% 55% at 80% 25%, ${_hex2rgbaTs(c2,0.13)} 0%, transparent 60%)`,
    `radial-gradient(ellipse 55% 50% at 15% 80%, ${_hex2rgbaTs(c3,0.12)} 0%, transparent 55%)`,
    `radial-gradient(ellipse 65% 55% at 82% 78%, ${_hex2rgbaTs(c4,0.12)} 0%, transparent 60%)`,
    `radial-gradient(ellipse 50% 45% at 50% 50%, ${_hex2rgbaTs(c5,0.08)} 0%, transparent 50%)`,
    `radial-gradient(ellipse 45% 40% at 65% 55%, ${_hex2rgbaTs(c6,0.07)} 0%, transparent 45%)`,
    `linear-gradient(180deg, #020408 0%, #030610 100%)`
  ].join(', ');
  return {
    id: `arch-${session.id}`,
    name: session.name,
    description: `${session.harmony} harmony`,
    colors: [c1, c2, c3],
    solidBg: '#020408ff',
    overrides: {
      // ── Tier 1: Palette ────────────────────────────────────────
      '--ftr10-accent-1': c1 + 'd4',
      '--ftr10-accent-2': c2,
      '--ftr10-accent-3': c3,
      '--ftr10-accent-4': c4,
      '--ftr10-surface-1': c5 + '30',
      '--ftr10-surface-2': c6 + '18',
      // ── Tier 1: UI ────────────────────────────────────────────
      '--ftr10-cursor': c4,
      '--ftr10-tab-border-color': c1,
      // ── Tier 1: Backgrounds ───────────────────────────────────
      '--ftr10-bg-effect': session.bgEffect || 'nebula',
      '--ftr10-thpace-enabled': session.thpaceEnabled || 'true',
      '--ftr10-bg': '#00000000',
      '--ftr10-bg-editor': '#020408ff',
      '--ftr10-bg-ambient': bgAmbient,
      // ── Tier 1: Text ──────────────────────────────────────────
      '--ftr10-text': '#ffffffe6',
      '--ftr10-text-muted': '#ffffff73',
      // ── Tier 1: Typography ────────────────────────────────────
      '--ftr10-body-font': "'Victor Mono', monospace",
      '--ftr10-heading-font': "'Orbitron', 'Victor Mono', monospace",
      '--ftr10-code-font': "'Victor Mono', monospace",
      '--ftr10-font-activitybar': "'Space Grotesk', monospace",
      '--ftr10-font-sidebar': "'Space Grotesk', monospace",
      '--ftr10-font-panel-bottom': "'Orbitron', monospace",
      '--ftr10-font-panel-top': "'JetBrains Mono', monospace",
      '--ftr10-font-auxiliarybar': "'Cartograph', monospace",
      // ── Tier 2: Derived from accent-1 (via accentDerived) ─────
      '--ftr10-border': c1 + '20',
      '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
      '--ftr10-editor-line-number-beam-gradient': `linear-gradient(90deg, ${c1} 0%, ${c4} 40%, ${c2} 70%, transparent 100%)`,
      '--ftr10-tab-active-beam-gradient': `linear-gradient(90deg, #050510 0%, ${c1} 25%, ${c4} 50%, ${c2} 75%, #050510 100%)`,
      // ── Tier 2: Syntax tokens (from palette) ─────────────────
      // Roles: c1=definition(fn/selector), c2=structure(keyword/op), c3=literal(string),
      //        c4=value(number/type), c5/c6=surface dark — never used as fg
      ...((): Record<string, string> => {
        const _W   = '#c8d8e8';                          // reference neutral
        const _c4l = _hexLerp(c4, '#ffffff', 0.28);     // brightened c4 — types, classes
        const _c1s = _hexLerp(c1, _W, 0.55);            // soft c1 — variables, properties
        const _c2m = _hexLerp(c2, '#807888', 0.35);     // muted c2 — punctuation
        const _c3m = _hexLerp(c3, '#90989c', 0.38);     // muted c3 — string escapes
        return {
          // Core language —————————————————————————————————
          '--ftr10-token-keyword':              c2,
          '--ftr10-token-keyword-control':      c2,
          '--ftr10-token-keyword-other':        _hexLerp(c2, c3, 0.4),
          '--ftr10-token-storage':              c2,
          '--ftr10-token-module':               _hexLerp(c2, c3, 0.35),
          '--ftr10-token-constant':             c4,
          '--ftr10-token-constant-placeholder': _hexLerp(c4, c3, 0.3),
          '--ftr10-token-string':               c3,
          '--ftr10-token-string-escape':        _c3m,
          '--ftr10-token-template':             _hexLerp(c3, c1, 0.25),
          '--ftr10-token-number':               c4,
          '--ftr10-token-boolean':              _hexLerp(c4, c2, 0.28),
          '--ftr10-token-function':             c1,
          '--ftr10-token-function-def':         c1,
          '--ftr10-token-type':                 _c4l,
          '--ftr10-token-class':                _c4l,
          '--ftr10-token-class-variable':       _c1s,
          '--ftr10-token-class-method':         c1,
          '--ftr10-token-comment':              _commentColorFromAccent(c1),
          '--ftr10-token-punctuation':          _c2m,
          '--ftr10-token-variable':             _c1s,
          '--ftr10-token-property':             _c1s,
          '--ftr10-token-operator':             c2,
          '--ftr10-token-tag':                  c2,
          '--ftr10-token-selector':             c1,
          '--ftr10-token-namespace':            _hexLerp(c1, _W, 0.68),
          '--ftr10-token-block':                _hexLerp(c3, c4, 0.4),
          // Markup ——————————————————————————————————————————
          '--ftr10-token-markup-deleted':       '#ff6b78',   // semantic diff red
          '--ftr10-token-markup-inserted':      '#73d980',   // semantic diff green
          // HTML / XML ——————————————————————————————————————
          '--ftr10-token-html-outer':           c2,
          '--ftr10-token-html-inner':           _hexLerp(c1, c2, 0.28),
          '--ftr10-token-html-attribute':       c3,
          '--ftr10-token-html-entity':          _c1s,
          // CSS ——————————————————————————————————————————————
          '--ftr10-token-css-class':            _c4l,
          '--ftr10-token-css-id':               _hexLerp(c4, c3, 0.35),
          '--ftr10-token-css-tag':              c2,
          '--ftr10-token-css-property':         _c1s,
          // YAML / JSON ——————————————————————————————————————
          '--ftr10-token-yaml-key':             c2,
          '--ftr10-token-json-key':             c2,
          '--ftr10-token-json-constant':        c4,
          '--ftr10-token-json-0':               c1,
          '--ftr10-token-json-1':               c2,
          '--ftr10-token-json-2':               c3,
          '--ftr10-token-json-3':               c4,
          '--ftr10-token-json-4':               _hexLerp(c4, c1, 0.4),
          '--ftr10-token-json-5':               _hexLerp(c1, c3, 0.4),
          '--ftr10-token-json-6':               _hexLerp(c2, c4, 0.4),
          '--ftr10-token-json-7':               _hexLerp(c3, c2, 0.4),
          '--ftr10-token-json-8':               _hexLerp(c4, c2, 0.5),
          // Markdown ——————————————————————————————————————————
          '--ftr10-token-md-heading':           c2,
          '--ftr10-token-md-link':              c1,
          '--ftr10-token-md-list':              _c2m,
          '--ftr10-token-md-italic':            _hexLerp(c3, _W, 0.4),
          '--ftr10-token-md-bold':              c3,
          '--ftr10-token-md-bold-italic':       _hexLerp(c3, c2, 0.3),
          '--ftr10-token-md-code':              c3,
          '--ftr10-token-md-inline-code':       c3,
          '--ftr10-token-md-blockquote':        _hexLerp(c1, _W, 0.6),
          '--ftr10-token-md-blockquote-punct':  _c2m,
          '--ftr10-token-md-fenced':            _c1s,
          // INI ——————————————————————————————————————————————
          '--ftr10-token-ini-property':         _hexLerp(c2, c3, 0.3),
          '--ftr10-token-ini-section':          c2,
          // C# ———————————————————————————————————————————————
          '--ftr10-token-cs-class':             _c4l,
          '--ftr10-token-cs-method':            c1,
          '--ftr10-token-cs-function':          c1,
          '--ftr10-token-cs-type':              _c4l,
          '--ftr10-token-cs-return':            _c4l,
          '--ftr10-token-cs-preprocessor':      '#545454',
          '--ftr10-token-cs-namespace':         _hexLerp(c1, _W, 0.68),
          // JSX ——————————————————————————————————————————————
          '--ftr10-token-jsx-text':             _hexLerp(c1, _W, 0.78),
          '--ftr10-token-jsx-component':        _c4l,
          // Python ———————————————————————————————————————————
          '--ftr10-token-py-member':            _c1s,
          '--ftr10-token-py-self':              _hexLerp(c2, _W, 0.58),
          '--ftr10-token-py-format':            c3,
          // C/C++ ————————————————————————————————————————————
          '--ftr10-token-cpp-variable':         _c1s,
        };
      })(),
      ...accentDerived(
        parseInt(c1.slice(1, 3), 16),
        parseInt(c1.slice(3, 5), 16),
        parseInt(c1.slice(5, 7), 16)
      ),
      // ── Tier 3: User-edited extra vars from the Vars panel ─────
      // Stored as a diff vs. the palette-derived set so re-derivation
      // reproduces the user's edits instead of silently dropping them.
      ...(session.varOverrides || {})
    }
  };
}

// Compute the extra-var diff to persist for a session: the subset of the
// live `varsState.values` that differs from what deriveCodexPreset() would
// produce from the palette alone. Storing a diff (not the whole set) keeps
// cards portable — if DEFAULT_VALUES or the derivation logic changes, the
// user's explicit overrides still win. Mirrors the presetCustomizations
// diff strategy used elsewhere (theme-sync §10).
function computeSessionVarDiff(session: ArchitectSession, liveValues: Record<string, string>): Record<string, string> {
  const derived = deriveCodexPreset(session).overrides;
  const diff: Record<string, string> = {};
  for (const [key, val] of Object.entries(liveValues || {})) {
    if (typeof val !== 'string') {continue;}
    if (key.startsWith('--ftr10-') && derived[key] !== val) {
      diff[key] = val;
    }
  }
  return diff;
}

import neonMatrix from './theme-presets/neon-matrix';
import midnightViolet from './theme-presets/midnight-violet';
import oceanBreeze from './theme-presets/ocean-breeze';
import solarFlare from './theme-presets/solar-flare';
import roseQuartz from './theme-presets/rose-quartz';
import arcticFrost from './theme-presets/arctic-frost';
import emberGlow from './theme-presets/ember-glow';
import monochrome from './theme-presets/monochrome';
import popoverUniverse from './theme-presets/popover-universe';
import emeraldForest from './theme-presets/emerald-forest';
import acesCodepunk from './theme-presets/aces-codepunk';
import classicMonokai from './theme-presets/classic-monokai';
import classicNight from './theme-presets/classic-night';
import classicAtomMaterial from './theme-presets/classic-atom-material';
import classicSolarizedDark from './theme-presets/classic-solarized-dark';

const THEME_PRESETS: ThemePreset[] = [
  neonMatrix,
  midnightViolet,
  oceanBreeze,
  solarFlare,
  roseQuartz,
  arcticFrost,
  emberGlow,
  monochrome,
  popoverUniverse,
  emeraldForest,
  acesCodepunk,
  classicMonokai,
  classicNight,
  classicAtomMaterial,
  classicSolarizedDark,
];
// ═══════════════════════════════════════════════════════════════════
// Default values
// ═══════════════════════════════════════════════════════════════════

const DEFAULT_VALUES: Record<string, string> = {
  '--ftr10-bg-editor': '#0f111700',
  '--ftr10-bg-ambient': 'none',
  '--ftr10-bg-sticky': '#0c0e13ff',
  '--ftr10-bg-image-panels': 'none',
  '--ftr10-bg-image': 'none',    // user-selected background image: url("../backgrounds/<file>") | none | <raw url>
  '--ftr10-bg-sidebar': 'var(--ftr10-panel-overlay), var(--ftr10-bg-image-panels)',
  '--ftr10-bg-panel-bottom': 'var(--ftr10-panel-overlay), var(--ftr10-bg-image-panels)',
  '--ftr10-accent-1-70': 'color-mix(in srgb, var(--ftr10-accent-1) 70%, transparent)',
  '--ftr10-accent-1-50': 'color-mix(in srgb, var(--ftr10-accent-1) 50%, transparent)',
  '--ftr10-accent-1-45': 'color-mix(in srgb, var(--ftr10-accent-1) 45%, transparent)',
  '--ftr10-accent-1-20': 'color-mix(in srgb, var(--ftr10-accent-1) 20%, transparent)',
  '--ftr10-accent-1-15': 'color-mix(in srgb, var(--ftr10-accent-1) 15%, transparent)',
  '--ftr10-accent-1-10': 'color-mix(in srgb, var(--ftr10-accent-1) 10%, transparent)',
  '--ftr10-accent-1-08': 'color-mix(in srgb, var(--ftr10-accent-1) 8%, transparent)',
  '--ftr10-accent-2': '#9b59b6',
  '--ftr10-accent-3': '#3498db',
  '--ftr10-accent-4': '#3498db',
  '--ftr10-surface-1': '#2bff0045',
  '--ftr10-surface-2': '#161a22',
  '--ftr10-on-accent': '#333333e6',
  '--ftr10-cursor': '#a1eb5d',
  '--ftr10-cursor-50': 'color-mix(in srgb, var(--ftr10-cursor) 50%, transparent)',
  '--ftr10-cursor-20': 'color-mix(in srgb, var(--ftr10-cursor) 20%, transparent)',
  '--ftr10-highlight': 'color-mix(in oklch, var(--ftr10-accent-1) 48%, var(--ftr10-bg))',
  '--ftr10-highlight-50': 'color-mix(in srgb, var(--ftr10-highlight) 50%, transparent)',
  '--ftr10-h1-color': 'var(--ftr10-accent-1)',
  '--ftr10-h2-color': 'var(--ftr10-accent-2)',
  '--ftr10-h3-color': 'var(--ftr10-accent-3)',
  '--ftr10-h4-color': 'var(--ftr10-accent-4)',
  '--ftr10-h5-color': 'var(--ftr10-surface-1)',
  '--ftr10-success': '#65bc4a',
  '--ftr10-success-90': 'color-mix(in srgb, var(--ftr10-success) 90%, transparent)',
  '--ftr10-success-60': 'color-mix(in srgb, var(--ftr10-success) 60%, transparent)',
  '--ftr10-success-30': 'color-mix(in srgb, var(--ftr10-success) 30%, transparent)',
  '--ftr10-success-08': 'color-mix(in srgb, var(--ftr10-success) 8%, transparent)',
  '--ftr10-error': '#ff5c75',
  '--ftr10-error-90': 'color-mix(in srgb, var(--ftr10-error) 90%, transparent)',
  '--ftr10-error-70': 'color-mix(in srgb, var(--ftr10-error) 70%, transparent)',
  '--ftr10-error-60': 'color-mix(in srgb, var(--ftr10-error) 60%, transparent)',
  '--ftr10-error-08': 'color-mix(in srgb, var(--ftr10-error) 8%, transparent)',
  '--ftr10-warning': '#f0b429',
  '--ftr10-warning-90': 'color-mix(in srgb, var(--ftr10-warning) 90%, transparent)',
  '--ftr10-warning-70': 'color-mix(in srgb, var(--ftr10-warning) 70%, transparent)',
  '--ftr10-warning-60': 'color-mix(in srgb, var(--ftr10-warning) 60%, transparent)',
  '--ftr10-warning-30': 'color-mix(in srgb, var(--ftr10-warning) 30%, transparent)',
  '--ftr10-info': '#38bdf8',
  '--ftr10-info-90': 'color-mix(in srgb, var(--ftr10-info) 90%, transparent)',
  '--ftr10-info-70': 'color-mix(in srgb, var(--ftr10-info) 70%, transparent)',
  '--ftr10-info-60': 'color-mix(in srgb, var(--ftr10-info) 60%, transparent)',
  '--ftr10-info-30': 'color-mix(in srgb, var(--ftr10-info) 30%, transparent)',
  '--ftr10-disabled': '#384149',
  '--ftr10-disabled-20': 'color-mix(in srgb, var(--ftr10-disabled) 20%, transparent)',
  '--ftr10-text': '#eaeaee',
  '--ftr10-text-muted': '#63676d',
  '--ftr10-text-80': 'color-mix(in srgb, var(--ftr10-text) 80%, transparent)',
  '--ftr10-text-70': 'color-mix(in srgb, var(--ftr10-text) 70%, transparent)',
  '--ftr10-text-60': 'color-mix(in srgb, var(--ftr10-text) 60%, transparent)',
  '--ftr10-text-40': 'color-mix(in srgb, var(--ftr10-text) 40%, transparent)',
  '--ftr10-text-30': 'color-mix(in srgb, var(--ftr10-text) 30%, transparent)',
  '--ftr10-text-15': 'color-mix(in srgb, var(--ftr10-text) 15%, transparent)',
  '--ftr10-text-10': 'color-mix(in srgb, var(--ftr10-text) 10%, transparent)',
  '--ftr10-text-06': 'color-mix(in srgb, var(--ftr10-text) 6%, transparent)',
  '--ftr10-text-05': 'color-mix(in srgb, var(--ftr10-text) 5%, transparent)',
  '--ftr10-text-muted-70': 'color-mix(in srgb, var(--ftr10-text-muted) 70%, transparent)',
  '--ftr10-text-muted-50': 'color-mix(in srgb, var(--ftr10-text-muted) 50%, transparent)',
  '--ftr10-strong-color': 'var(--ftr10-text)',
  '--ftr10-em-color': 'var(--ftr10-text-muted)',
  '--ftr10-mark-bg': '#cb808059',
  '--ftr10-mark-color': 'var(--ftr10-text)',
  '--ftr10-surface-1-50': 'color-mix(in srgb, var(--ftr10-surface-1) 50%, transparent)',
  '--ftr10-surface-2-60': 'color-mix(in srgb, var(--ftr10-surface-2) 60%, transparent)',
  '--ftr10-surface-3': '#232838',
  '--ftr10-surface-3-60': 'color-mix(in srgb, var(--ftr10-surface-3) 60%, transparent)',
  '--ftr10-surface': 'var(--ftr10-surface-1)',
  '--ftr10-surface-hover': 'var(--ftr10-surface-2)',
  '--ftr10-glass-bg': '#13161d80',
  '--ftr10-glass-bg-menu': '#0d0f16c7',
  '--ftr10-glass-bg-menu-layer': '#0d0f1680',
  '--ftr10-glass-bg-widget': '#13161dc7',
  '--ftr10-glass-bg-widget-strong': '#0f1117f0',
  '--ftr10-glass-bg-overlay': '#0a0c128c',
  '--ftr10-glass-bg-hover': '#a1eb5d12',
  '--ftr10-glass-bg-active': '#a1eb5d1f',
  '--ftr10-glass-bg-breadcrumb-hover': '#a1eb5d0f',
  '--ftr10-glass-bg-sticky': '#0c0e13d9',
  '--ftr10-border': '#1f2530',
  '--ftr10-border-base': '#a1eb5d1a',
  '--ftr10-border-base-70': '#a1eb5d12',
  '--ftr10-border-subtle': '#a1eb5d0d',
  '--ftr10-border-style': 'solid',
  '--ftr10-glass-border-top': '2px solid #a1eb5d2e',
  '--ftr10-glass-border-side': '2px solid #a1eb5d14',
  '--ftr10-glass-border-bottom': '2px solid #0000004c',
  '--ftr10-glass-border-top-soft': '1px solid #eaeaee1a',
  '--ftr10-glass-border-side-soft': '1px solid #eaeaee0d',
  '--ftr10-glass-border-bottom-soft': '1px solid #00000033',
  '--ftr10-glass-outline-soft': '1px solid #a1eb5d1a',
  '--ftr10-inset-light-edges': 'inset 0 1px 0 0 #a1eb5d24, inset 1px 0 0 0 #a1eb5d12, inset 0 -1px 0 0 #00000014, inset -1px 0 0 0 #0000000a',
  '--ftr10-inset-light-shadow': 'inset 0 1px 2px 0 #a1eb5d0f',
  '--ftr10-inset-dark-shadow': '0 1px 3px 0 #00000059',
  '--ftr10-body-font': '"Inter", "Segoe UI", sans-serif',
  '--ftr10-heading-font': '"Inter", "Segoe UI", sans-serif',
  '--ftr10-code-font': '"JetBrains Mono", "Fira Code", monospace',
  '--ftr10-font-activitybar': 'inherit',
  '--ftr10-font-sidebar': 'inherit',
  '--ftr10-font-panel-bottom': 'inherit',
  '--ftr10-font-panel-top': 'inherit',
  '--ftr10-font-auxiliarybar': 'inherit',
  '--ftr10-heading-spacing': 'normal',
  '--ftr10-heading-transform': 'none',
  '--ftr10-radius-xs': '4px',
  '--ftr10-radius-sm': '6px',
  '--ftr10-radius-md': '10px',
  '--ftr10-radius-lg': '14px',
  '--ftr10-radius-row': '20px',
  '--ftr10-radius-beam': '50px',
  '--ftr10-radius-pill': '9999px',
  '--ftr10-radius-selections': 'var(--ftr10-radius-sm)',
  '--ftr10-radius-panes': 'var(--ftr10-radius-lg)',
  '--ftr10-corner-shape': 'squircle',
  '--ftr10-radius-img': '8px',
  '--ftr10-radius-inline': '3px',
  '--ftr10-radius-block': '8px',
  '--ftr10-radius-quote': '4px',
  '--ftr10-shadow-light': '2px 2px 8px 4px #00000040',
  '--ftr10-shadow-focus': '#a1eb5d66',
  '--ftr10-shadow-heavy': '0 4px 20px #00000099',
  '--ftr10-shadow-popup': '0 8px 32px #00000080, 0 0 0 1px #a1eb5d1a',
  '--ftr10-shadow-dialog': '0 16px 48px #000000a6',
  '--ftr10-shadow-selection': '0 0 0 1px #a1eb5d4c, 0 0 20px #a1eb5d26, 0 0 40px #a1eb5d14',
  '--ftr10-shadow-selected-focused': '1px 1px 1px 1px #a1eb5d59, 1px 1px 7px 0px #a1eb5d8c',
  '--ftr10-shadow-inner-outline': 'inset 0 0 0 1px #a1eb5d14',
  '--ftr10-blur-sm': 'blur(2px)',
  '--ftr10-blur-md': 'blur(8px)',
  '--ftr10-blur-lg': 'blur(12px)',
  '--ftr10-opacity-activitybar': '0.4',
  '--ftr10-opacity-sidebar': '0.4',
  '--ftr10-opacity-panel-bottom': '0.4',
  '--ftr10-opacity-panel-top': '0.4',
  '--ftr10-opacity-auxiliarybar': '0.4',
  '--ftr10-opacity-pane': '1',
  '--ftr10-activitybar-hover-bg': '#a1eb5d1f',
  '--ftr10-activitybar-hover-outer-glow': '0 0 20px #a1eb5d4c',
  '--ftr10-activitybar-hover-inner-glow': 'inset 0 0 15px #a1eb5d26',
  '--ftr10-activitybar-hover-image-opacity': '1',
  '--ftr10-list-bg-hover': '#121212db',
  '--ftr10-tab-border-color': '#a1eb5d',
  '--ftr10-tab-gradient': 'linear-gradient(to top, var(--ftr10-tab-border-color) 1px, transparent 1px)',
  '--ftr10-accent-shadow-red': '1px 1px 1px 1px #a1eb5d59',
  '--ftr10-accent-shadow-red-strong': '1px 1px 7px 0px #a1eb5db2',
  '--ftr10-text-shadow-hover': '0 0 5px #a1eb5d66',
  '--ftr10-editor-current-line-bg': '#a1eb5d0a',
  '--ftr10-editor-line-number-active': 'var(--ftr10-success)',
  '--ftr10-editor-line-number-inactive': 'var(--ftr10-warning)',
  '--ftr10-editor-line-number-beam-gradient': 'linear-gradient(90deg, #a1eb5d 0%, #7ad24e 40%, #65bc4a 70%, transparent 100%)',
  '--ftr10-editor-line-number-beam-height': '2px',
  '--ftr10-editor-line-number-beam-inset': '12px',
  '--ftr10-editor-line-number-beam-duration': '3s',
  '--ftr10-tab-active-beam-gradient': 'linear-gradient(90deg, #0b260b 0%, #65bc4a 25%, #a1eb5d 50%, #7ad24e 75%, #0b260b 100%)',
  '--ftr10-tab-active-beam-height': '4px',
  '--ftr10-tab-active-beam-radius': '50px',
  '--ftr10-tab-active-beam-duration': '6s',
  '--ftr10-tab-active-stripe-gradient': 'repeating-linear-gradient(-70deg, #ffffff00 0px, #ffffff00 8px, #a1eb5d1a 8px, #a1eb5d1a 16px)',
  '--ftr10-tab-active-stripe-height': '6px',
  '--ftr10-tab-active-stripe-duration': '1s',
  '--ftr10-code-bg': '#0000004c',
  '--ftr10-code-border-l': 'var(--ftr10-accent-1)',
  '--ftr10-code-border-r': 'transparent',
  '--ftr10-code-scanline': '#ffffff05',
  '--ftr10-blockquote-bg': '#00000033',
  '--ftr10-blockquote-width': '3px',
  '--ftr10-blockquote-border': 'var(--ftr10-accent-1)',
  '--ftr10-link-style': 'solid',
  '--ftr10-link-hover-shadow': 'none',
  '--ftr10-link-hover-transform': 'none',
  // Core language tokens
  '--ftr10-token-string':                '#C3E88D',
  '--ftr10-token-string-escape':         '#D9D9D9',
  '--ftr10-token-number':                '#F78C6C',
  '--ftr10-token-boolean':               '#ff9cac',
  '--ftr10-token-variable':              '#D9D9D9',
  '--ftr10-token-keyword':               '#89DDFF',
  '--ftr10-token-keyword-other':         '#F78C6C',
  '--ftr10-token-keyword-control':       '#89DDFF',
  '--ftr10-token-constant':              '#89DDFF',
  '--ftr10-token-constant-placeholder':  '#f07178',
  '--ftr10-token-function':              '#82AAFF',
  '--ftr10-token-function-def':          '#82AAFF',
  '--ftr10-token-storage':               '#C792EA',
  '--ftr10-token-module':                '#f07178',
  '--ftr10-token-type':                  '#FFCB6B',
  '--ftr10-token-class':                 '#FFCB6B',
  '--ftr10-token-class-variable':        '#f07178',
  '--ftr10-token-class-method':          '#f07178',
  '--ftr10-token-comment':               '#ff45b8',
  '--ftr10-token-punctuation':           '#89DDFF',
  '--ftr10-token-template':              '#89DDFF',
  '--ftr10-token-namespace':             '#D9D9D9',
  '--ftr10-token-block':                 '#f07178',
  '--ftr10-token-markup-deleted':        '#f07178',
  '--ftr10-token-markup-inserted':       '#C3E88D',
  // YAML / JSON tokens
  '--ftr10-token-yaml-key':              '#f07178',
  '--ftr10-token-json-key':              '#f07178',
  '--ftr10-token-json-constant':         '#89DDFF',
  '--ftr10-token-json-0':                '#C792EA',
  '--ftr10-token-json-1':                '#FFCB6B',
  '--ftr10-token-json-2':                '#F78C6C',
  '--ftr10-token-json-3':                '#f07178',
  '--ftr10-token-json-4':                '#916b53',
  '--ftr10-token-json-5':                '#82AAFF',
  '--ftr10-token-json-6':                '#ff9cac',
  '--ftr10-token-json-7':                '#C792EA',
  '--ftr10-token-json-8':                '#C3E88D',
  // CSS tokens
  '--ftr10-token-css-class':             '#FFCB6B',
  '--ftr10-token-css-id':                '#F78C6C',
  '--ftr10-token-css-tag':               '#FFCB6B',
  '--ftr10-token-css-property':          '#B2CCD6',
  // HTML tokens
  '--ftr10-token-html-outer':            '#89DDFF',
  '--ftr10-token-html-inner':            '#f07178',
  '--ftr10-token-html-attribute':        '#C792EA',
  '--ftr10-token-html-entity':           '#D9D9D9',
  // Markdown tokens
  '--ftr10-token-md-heading':            '#89DDFF',
  '--ftr10-token-md-link':               '#f07178',
  '--ftr10-token-md-list':               '#89DDFF',
  '--ftr10-token-md-italic':             '#f07178',
  '--ftr10-token-md-bold':               '#f07178',
  '--ftr10-token-md-bold-italic':        '#f07178',
  '--ftr10-token-md-code':               '#C3E88D',
  '--ftr10-token-md-inline-code':        '#C3E88D',
  '--ftr10-token-md-blockquote':         '#89DDFF',
  '--ftr10-token-md-blockquote-punct':   '#ff9cac',
  '--ftr10-token-md-fenced':             '#D9D9D9',
  // INI tokens
  '--ftr10-token-ini-property':          '#f07178',
  '--ftr10-token-ini-section':           '#89DDFF',
  // C# tokens
  '--ftr10-token-cs-class':              '#FFCB6B',
  '--ftr10-token-cs-method':             '#f07178',
  '--ftr10-token-cs-function':           '#82AAFF',
  '--ftr10-token-cs-type':               '#FFCB6B',
  '--ftr10-token-cs-return':             '#FFCB6B',
  '--ftr10-token-cs-preprocessor':       '#545454',
  '--ftr10-token-cs-namespace':          '#D9D9D9',
  // JSX tokens
  '--ftr10-token-jsx-text':              '#D9D9D9',
  '--ftr10-token-jsx-component':         '#FFCB6B',
  // Python tokens
  '--ftr10-token-py-member':             '#f07178',
  '--ftr10-token-py-self':               '#D9D9D9',
  '--ftr10-token-py-format':             '#F78C6C',
  // C/C++ tokens
  '--ftr10-token-cpp-variable':          '#D9D9D9',
  // Legacy preset-compat aliases (still settable but superseded by 1:1 vars above)
  '--ftr10-token-operator':              '#89DDFF',
  '--ftr10-token-property':              '#D9D9D9',
  '--ftr10-token-tag':                   '#f07178',
  '--ftr10-token-selector':              '#FFCB6B',
  '--ftr10-charts-blue': 'var(--ftr10-info)',
  '--ftr10-charts-green': 'var(--ftr10-success)',
  '--ftr10-charts-orange': 'var(--ftr10-warning)',
  '--ftr10-charts-purple': 'var(--ftr10-purple)',
  '--ftr10-charts-red': 'var(--ftr10-error)',
  '--ftr10-charts-yellow': 'var(--ftr10-warning)',
  '--ftr10-thpace-enabled': 'true',
  '--ftr10-thpace-opacity': '0.9',
  '--ftr10-thpace-zindex': '0',
  '--ftr10-thpace-triangle-size': '160',
  '--ftr10-thpace-bleed': '140',
  '--ftr10-thpace-noise': '70',
  '--ftr10-thpace-point-variation-x': '18',
  '--ftr10-thpace-point-variation-y': '32',
  '--ftr10-thpace-animation-speed': '9000',
  '--ftr10-thpace-max-fps': '30',
  '--ftr10-thpace-colors': '["--ftr10-thpace-1","--ftr10-thpace-2","--ftr10-thpace-3"]',
  '--ftr10-thpace-1': '--ftr10-accent-1',
  '--ftr10-thpace-2': 'transparent',
  '--ftr10-thpace-3': '--ftr10-accent-3'
};

// ═══════════════════════════════════════════════════════════════════
// Global state
// ═══════════════════════════════════════════════════════════════════

let panel: vscode.WebviewPanel | undefined;
let CodexPanel: vscode.WebviewPanel | undefined;
// Runtime registry of currently-open webview panels. Populated on creation
// (click time), NOT at module init — so esbuild can't dead-code-eliminate a
// reference to a module global that is `undefined` at init. pushVarsLive
// iterates this so a live color edit reaches whichever panel the user is in.
const livePanels: vscode.WebviewPanel[] = [];
function registerLivePanel(p: vscode.WebviewPanel | undefined): void {
  if (!p) {return;}
  if (livePanels.indexOf(p) === -1) {livePanels.push(p);}
}
function unregisterLivePanel(p: vscode.WebviewPanel | undefined): void {
  const i = p ? livePanels.indexOf(p) : -1;
  if (i !== -1) {livePanels.splice(i, 1);}
}
let sidebarProvider: ThemeSidebarProvider | undefined;
let watcher: chokidar.FSWatcher | undefined;
let themeConfig: ThemeConfig = { sections: [], values: {}, cssImports: [], customCss: '', presetCustomizations: {}, presetBackgroundMode: {}, architectSessions: {} };
let profilePath = '';
let extensionRoot = '';
let _togglingTheme = false;

// ═══════════════════════════════════════════════════════════════════
// Activation
// ═══════════════════════════════════════════════════════════════════

export function activateThemeSync(context: vscode.ExtensionContext): void {
  const configPath = vscode.workspace.getConfiguration('themeSync').get<string>('profilePath', '');
  profilePath = configPath || path.join(os.homedir(), '.ftr10');
  extensionRoot = context.extensionUri.fsPath;
  fs.mkdirSync(profilePath, { recursive: true });

  const themeJsonPath = path.join(profilePath, 'theme.json');
  if (!fs.existsSync(themeJsonPath)) {
    const defaults = buildDefaultConfig();
    fs.writeFileSync(themeJsonPath, JSON.stringify(defaults, null, 2));
    themeConfig = flattenConfig(defaults);
  } else {
    const raw = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8')) as RawThemeJson;
    themeConfig = flattenConfig(raw);
    migrateConfig();
  }

  // Seed Base session cards from static presets (issue #4)
  try {
    if (ensureBaseSessions()) {
      // Persist the newly seeded base sessions
      persistThemeConfig();
    }
  } catch (e) { console.error('[FTR10] ensureBaseSessions failed', e); }

  // One-time repair: regenerate colors.css to fix previous corruption (double ;;, data URI handling)
  try {
    regenerateColorsCss(themeConfig.values);
    // Also clean other css files of double semicolons via robust updater
    updateAllCssFiles(themeConfig.values, ['--ftr10-bg-image-panels', '--ftr10-highlight']);
  } catch {}

  // Register sidebar webview provider
  sidebarProvider = new ThemeSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('themeSync.sidebar', sidebarProvider)
  );

  const openPanelCmd = vscode.commands.registerCommand('themeSync.openPanel', () => {
    if (panel) {panel.reveal(vscode.ViewColumn.One);}
    else {createPanel(context);}
  });

  const patchCmd = vscode.commands.registerCommand('themeSync.patchWorkbench', () => patchWorkbench(profilePath));

  const applyPresetCmd = vscode.commands.registerCommand('themeSync.applyPreset', (presetId: string) => {
    applyPreset(presetId);
  });

  context.subscriptions.push(openPanelCmd, patchCmd, applyPresetCmd);

  watcher = chokidar.watch(themeJsonPath, { ignoreInitial: true });
  watcher.on('change', () => {
    try {
      const raw = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8')) as RawThemeJson;
      themeConfig = flattenConfig(raw);
      // colors.css is canonical, so re-apply it over theme.json values
      try {
        const canonical = parseColorsCssFile();
        if (Object.keys(canonical).length) {themeConfig.values = { ...themeConfig.values, ...canonical };}
      } catch {}
      generateShim(profilePath, themeConfig);
      updateWebviewUI();
      sidebarProvider?.syncActivePreset();
    } catch (err) {
      console.error('Error watching theme.json:', err);
    }
  });

  // Canonical watcher: colors.css is source of truth
  const colorsCssPath = path.join(profilePath, 'css.files', 'colors.css');
  let colorsCssWatcher: any = null;
  try {
    colorsCssWatcher = chokidar.watch(colorsCssPath, { ignoreInitial: true });
    let _cssDebounce: any = null;
    colorsCssWatcher.on('change', () => {
      clearTimeout(_cssDebounce);
      _cssDebounce = setTimeout(() => {
        try {
          syncAllFromColorsCss();
          sidebarProvider?.syncActivePreset();
        } catch (e) { console.error('colors.css watcher failed', e); }
      }, 150);
    });
    context.subscriptions.push({ dispose: () => { try { colorsCssWatcher?.close(); } catch {} } });
  } catch(e){ console.error('Failed to watch colors.css', e); }

  context.subscriptions.push({ dispose: () => watcher?.close() });
  // On activation, ensure colors.css is canonical: if it exists, it wins over theme.json
  try {
    const existing = parseColorsCssFile();
    if (Object.keys(existing).length > 10) {
      themeConfig.values = { ...themeConfig.values, ...existing };
    } else {
      regenerateColorsCss(themeConfig.values);
    }
  } catch { try { regenerateColorsCss(themeConfig.values); } catch {} }
  generateShim(profilePath, themeConfig);
  writeVarsJson(profilePath, themeConfig);
  // Full sync from canonical to ensure vars.json, terminal, tokens, etc. reflect colors.css
  try { syncAllFromColorsCss(); } catch {}
}

export function deactivateThemeSync(): void {
  watcher?.close();
  panel?.dispose();
}

// ═══════════════════════════════════════════════════════════════════
// Migration — fills in any keys/values added after initial install
// ═══════════════════════════════════════════════════════════════════

function migrateConfig(): void {
  const canonical = flattenConfig(buildDefaultConfig());

  // 1. Add any missing values from DEFAULT_VALUES
  // Only fill if the key is strictly absent (undefined) — empty string is a valid intentional value
  let valuesChanged = false;
  for (const [key, defaultVal] of Object.entries(canonical.values)) {
    if (themeConfig.values[key] === undefined) {
      themeConfig.values[key] = defaultVal;
      valuesChanged = true;
    }
  }

  // 1b. Repair legacy token defaults that have since been corrected in the source defaults.
  const legacyTokenMigrations: Record<string, Record<string, string>> = {
    '--ftr10-token-keyword': {
      '#f78aff': '#89DDFF'
    },
    '--ftr10-token-css-class': {
      '#c46bff': '#FFCB6B'
    }
  };
  for (const [token, mapping] of Object.entries(legacyTokenMigrations)) {
    const current = themeConfig.values[token];
    if (typeof current === 'string') {
      const normalized = current.trim().toLowerCase();
      for (const [legacyValue, replacement] of Object.entries(mapping)) {
        if (normalized === legacyValue.toLowerCase()) {
          themeConfig.values[token] = replacement;
          valuesChanged = true;
        }
      }
    }
  }

  // 2. Sync section key arrays — add missing keys, preserve order, keep custom keys
  let sectionsChanged = false;
  for (const canonicalSection of canonical.sections) {
    const existing = themeConfig.sections.find(s => s.name === canonicalSection.name);
    if (!existing) {
      themeConfig.sections.push({ ...canonicalSection });
      sectionsChanged = true;
    } else {
      for (const key of canonicalSection.keys) {
        if (!existing.keys.includes(key)) {
          existing.keys.push(key);
          sectionsChanged = true;
        }
      }
    }
  }

  if (valuesChanged || sectionsChanged) {
    persistThemeConfig();
  }
}

// ═══════════════════════════════════════════════════════════════════
// Default config builder
// ═══════════════════════════════════════════════════════════════════

function buildDefaultConfig(): RawThemeJson {
  const sections: Section[] = [
    { name: 'Backgrounds', keys: ['--ftr10-bg','--ftr10-bg-editor','--ftr10-bg-sticky','--ftr10-bg-image-panels','--ftr10-panel-overlay','--ftr10-bg-activitybar','--ftr10-bg-sidebar','--ftr10-bg-panel-bottom','--ftr10-bg-panel-top','--ftr10-bg-auxiliarybar','--ftr10-bg-pattern','--ftr10-bg-pattern-size','--ftr10-bg-pattern-pos','--ftr10-bg-effect'] },
    { name: 'Accents', keys: ['--ftr10-accent-1','--ftr10-accent-1-80','--ftr10-accent-1-70','--ftr10-accent-1-50','--ftr10-accent-1-45','--ftr10-accent-1-20','--ftr10-accent-1-15','--ftr10-accent-1-10','--ftr10-accent-1-08','--ftr10-accent-2','--ftr10-accent-3','--ftr10-accent-4','--ftr10-accent-5','--ftr10-cyan','--ftr10-purple','--ftr10-on-accent','--ftr10-cursor','--ftr10-cursor-50','--ftr10-cursor-20','--ftr10-highlight','--ftr10-highlight-50'] },
    { name: 'Headings', keys: ['--ftr10-h1-color','--ftr10-h2-color','--ftr10-h3-color','--ftr10-h4-color','--ftr10-h5-color'] },
    { name: 'Semantic Colors', keys: ['--ftr10-success','--ftr10-success-90','--ftr10-success-60','--ftr10-success-30','--ftr10-success-08','--ftr10-error','--ftr10-error-90','--ftr10-error-70','--ftr10-error-60','--ftr10-error-08','--ftr10-warning','--ftr10-warning-90','--ftr10-warning-70','--ftr10-warning-60','--ftr10-warning-30','--ftr10-info','--ftr10-info-90','--ftr10-info-70','--ftr10-info-60','--ftr10-info-30','--ftr10-disabled','--ftr10-disabled-20'] },
    { name: 'Text', keys: ['--ftr10-text','--ftr10-text-muted','--ftr10-text-80','--ftr10-text-70','--ftr10-text-60','--ftr10-text-40','--ftr10-text-30','--ftr10-text-15','--ftr10-text-10','--ftr10-text-06','--ftr10-text-05','--ftr10-text-muted-70','--ftr10-text-muted-50','--ftr10-strong-color','--ftr10-em-color','--ftr10-mark-bg','--ftr10-mark-color'] },
    { name: 'Surfaces', keys: ['--ftr10-surface-1','--ftr10-surface-1-50','--ftr10-surface-2','--ftr10-surface-2-60','--ftr10-surface-3','--ftr10-surface-3-60','--ftr10-surface','--ftr10-surface-hover','--ftr10-glass-bg','--ftr10-glass-bg-menu','--ftr10-glass-bg-menu-layer','--ftr10-glass-bg-widget','--ftr10-glass-bg-widget-strong','--ftr10-glass-bg-overlay','--ftr10-glass-bg-hover','--ftr10-glass-bg-active','--ftr10-glass-bg-breadcrumb-hover','--ftr10-glass-bg-sticky'] },
    { name: 'Borders', keys: ['--ftr10-border','--ftr10-border-base','--ftr10-border-base-70','--ftr10-border-subtle','--ftr10-border-style','--ftr10-glass-border-top','--ftr10-glass-border-side','--ftr10-glass-border-bottom','--ftr10-glass-border-top-soft','--ftr10-glass-border-side-soft','--ftr10-glass-border-bottom-soft','--ftr10-glass-outline-soft','--ftr10-inset-light-edges','--ftr10-inset-light-shadow','--ftr10-inset-dark-shadow'] },
    { name: 'Font Settings', keys: ['--ftr10-body-font','--ftr10-heading-font','--ftr10-code-font','--ftr10-font-activitybar','--ftr10-font-sidebar','--ftr10-font-panel-bottom','--ftr10-font-panel-top','--ftr10-font-auxiliarybar','--ftr10-heading-spacing','--ftr10-heading-transform'] },
    { name: 'Radii', keys: ['--ftr10-radius-xs','--ftr10-radius-sm','--ftr10-radius-md','--ftr10-radius-lg','--ftr10-radius-row','--ftr10-radius-beam','--ftr10-radius-pill','--ftr10-radius-selections','--ftr10-radius-panes','--ftr10-corner-shape','--ftr10-radius-img','--ftr10-radius-inline','--ftr10-radius-block','--ftr10-radius-quote'] },
    { name: 'Shadows', keys: ['--ftr10-shadow-light','--ftr10-shadow-focus','--ftr10-shadow-heavy','--ftr10-shadow-popup','--ftr10-shadow-dialog','--ftr10-shadow-selection','--ftr10-shadow-selected-focused','--ftr10-shadow-inner-outline'] },
    { name: 'Blur', keys: ['--ftr10-blur-sm','--ftr10-blur-md','--ftr10-blur-lg'] },
    { name: 'Panel Opacity', keys: ['--ftr10-opacity-activitybar','--ftr10-opacity-sidebar','--ftr10-opacity-panel-bottom','--ftr10-opacity-panel-top','--ftr10-opacity-auxiliarybar','--ftr10-opacity-pane'] },
    { name: 'Activity Bar', keys: ['--ftr10-activitybar-hover-bg','--ftr10-activitybar-hover-outer-glow','--ftr10-activitybar-hover-inner-glow','--ftr10-activitybar-hover-image-opacity'] },
    { name: 'Tabs & List', keys: ['--ftr10-list-bg-hover','--ftr10-tab-border-color','--ftr10-tab-gradient','--ftr10-accent-shadow-red','--ftr10-accent-shadow-red-strong','--ftr10-text-shadow-hover'] },
    { name: 'Editor', keys: ['--ftr10-editor-current-line-bg','--ftr10-editor-line-number-active','--ftr10-editor-line-number-inactive','--ftr10-editor-line-number-beam-gradient','--ftr10-editor-line-number-beam-height','--ftr10-editor-line-number-beam-inset','--ftr10-editor-line-number-beam-duration','--ftr10-tab-active-beam-gradient','--ftr10-tab-active-beam-height','--ftr10-tab-active-beam-radius','--ftr10-tab-active-beam-duration','--ftr10-tab-active-stripe-gradient','--ftr10-tab-active-stripe-height','--ftr10-tab-active-stripe-duration'] },
    { name: 'Code Blocks', keys: ['--ftr10-code-bg','--ftr10-code-border-l','--ftr10-code-border-r','--ftr10-code-scanline'] },
    { name: 'Blockquotes', keys: ['--ftr10-blockquote-bg','--ftr10-blockquote-width','--ftr10-blockquote-border'] },
    { name: 'Links', keys: ['--ftr10-link-style','--ftr10-link-hover-shadow','--ftr10-link-hover-transform'] },
    { name: 'Syntax Tokens', keys: ['--ftr10-token-string','--ftr10-token-string-escape','--ftr10-token-number','--ftr10-token-boolean','--ftr10-token-variable','--ftr10-token-keyword','--ftr10-token-keyword-other','--ftr10-token-keyword-control','--ftr10-token-constant','--ftr10-token-constant-placeholder','--ftr10-token-function','--ftr10-token-function-def','--ftr10-token-storage','--ftr10-token-module','--ftr10-token-type','--ftr10-token-class','--ftr10-token-class-variable','--ftr10-token-class-method','--ftr10-token-comment','--ftr10-token-punctuation','--ftr10-token-template','--ftr10-token-namespace','--ftr10-token-block','--ftr10-token-markup-deleted','--ftr10-token-markup-inserted'] },
    { name: 'Syntax - JSON', keys: ['--ftr10-token-yaml-key','--ftr10-token-json-key','--ftr10-token-json-constant','--ftr10-token-json-0','--ftr10-token-json-1','--ftr10-token-json-2','--ftr10-token-json-3','--ftr10-token-json-4','--ftr10-token-json-5','--ftr10-token-json-6','--ftr10-token-json-7','--ftr10-token-json-8'] },
    { name: 'Syntax - Web', keys: ['--ftr10-token-css-class','--ftr10-token-css-id','--ftr10-token-css-tag','--ftr10-token-css-property','--ftr10-token-html-outer','--ftr10-token-html-inner','--ftr10-token-html-attribute','--ftr10-token-html-entity'] },
    { name: 'Syntax - Markdown', keys: ['--ftr10-token-md-heading','--ftr10-token-md-link','--ftr10-token-md-list','--ftr10-token-md-italic','--ftr10-token-md-bold','--ftr10-token-md-bold-italic','--ftr10-token-md-code','--ftr10-token-md-inline-code','--ftr10-token-md-blockquote','--ftr10-token-md-blockquote-punct','--ftr10-token-md-fenced'] },
    { name: 'Syntax - Languages', keys: ['--ftr10-token-ini-property','--ftr10-token-ini-section','--ftr10-token-cs-class','--ftr10-token-cs-method','--ftr10-token-cs-function','--ftr10-token-cs-type','--ftr10-token-cs-return','--ftr10-token-cs-preprocessor','--ftr10-token-cs-namespace','--ftr10-token-jsx-text','--ftr10-token-jsx-component','--ftr10-token-py-member','--ftr10-token-py-self','--ftr10-token-py-format','--ftr10-token-cpp-variable'] },
    { name: 'Charts', keys: ['--ftr10-charts-blue','--ftr10-charts-green','--ftr10-charts-orange','--ftr10-charts-purple','--ftr10-charts-red','--ftr10-charts-yellow'] },
    { name: 'Thpace Background', keys: ['--ftr10-thpace-enabled','--ftr10-thpace-opacity','--ftr10-thpace-zindex','--ftr10-thpace-triangle-size','--ftr10-thpace-bleed','--ftr10-thpace-noise','--ftr10-thpace-point-variation-x','--ftr10-thpace-point-variation-y','--ftr10-thpace-animation-speed','--ftr10-thpace-max-fps','--ftr10-thpace-1','--ftr10-thpace-2','--ftr10-thpace-3','--ftr10-thpace-colors'] }
  ];

  return {
    ftr10Variables: { sections, values: DEFAULT_VALUES },
    cssImports: ['css.files/colors.css', 'css.files/main.css', 'css.files/font_load.css', 'css.files/effects.css'],
    customCss: '',
    lastModified: Date.now(),
    activePreset: 'neon-matrix'
  };
}

// ═══════════════════════════════════════════════════════════════════
// Config helpers
// ═══════════════════════════════════════════════════════════════════

function flattenConfig(raw: RawThemeJson): ThemeConfig {
  const pc = raw.presetCustomizations || {};
  const as_ = raw.architectSessions || {};
  const v = raw.ftr10Variables;
  if (v && typeof v === 'object' && 'sections' in v && Array.isArray(v.sections)) {
    return {
      sections: v.sections as Section[],
      values: (v.values || {}) as Record<string, string>,
      cssImports: raw.cssImports || [],
      customCss: raw.customCss || '',
      activePreset: raw.activePreset,
      presetCustomizations: pc,
      presetBackgroundMode: raw.presetBackgroundMode || {},
      architectSessions: as_
    };
  }
  if (v && typeof v === 'object' && !('sections' in v)) {
    return {
      sections: [],
      values: v as Record<string, string>,
      cssImports: raw.cssImports || [],
      customCss: raw.customCss || '',
      activePreset: raw.activePreset,
      presetCustomizations: pc,
      presetBackgroundMode: raw.presetBackgroundMode || {},
      architectSessions: as_
    };
  }
  return { sections: [], values: {}, cssImports: raw.cssImports || [], customCss: raw.customCss || '', activePreset: raw.activePreset, presetCustomizations: pc, presetBackgroundMode: raw.presetBackgroundMode || {}, architectSessions: as_ };
}

// ── Robust CSS var replacement ───────────────────────────────────────────────
// Handles data: URIs (which contain ;) by tracking paren depth and quote state.
// Replaces all occurrences of --var: ...; across a CSS string.
function replaceCssVarRobust(css: string, key: string, newVal: string): string {
  let out = '';
  let cursor = 0;
  while (true) {
    const idx = css.indexOf(key, cursor);
    if (idx === -1) { out += css.slice(cursor); break; }
    // Verify it's a declaration: optional ws, then ':'
    let afterKey = idx + key.length;
    while (afterKey < css.length && /\s/.test(css[afterKey])) {afterKey++;}
    if (afterKey >= css.length || css[afterKey] !== ':') {
      out += css.slice(cursor, idx + key.length);
      cursor = idx + key.length;
      continue;
    }
    // Check preceding char is start, whitespace, {, ;, or newline to avoid substring match
    const prev = idx > 0 ? css[idx-1] : '\n';
    if (/[A-Za-z0-9\-_]/.test(prev)) {
      out += css.slice(cursor, idx + key.length);
      cursor = idx + key.length;
      continue;
    }
    // Copy up to colon+space
    out += css.slice(cursor, afterKey + 1); // includes ':'
    let pos = afterKey + 1; // after colon
    // Scan to end of value: find ';' at depth 0 not in quotes, or '}'.
    let depth = 0;
    let inSingle = false, inDouble = false;
    let k = pos;
    while (k < css.length) {
      const ch = css[k];
      if (inSingle) {
        if (ch === "'" && css[k-1] !== '\\') {inSingle = false;}
      } else if (inDouble) {
        if (ch === '"' && css[k-1] !== '\\') {inDouble = false;}
      } else {
        if (ch === "'") {inSingle = true;}
        else if (ch === '"') {inDouble = true;}
        else if (ch === '(') {depth++;}
        else if (ch === ')') { if (depth>0) {depth--;} }
        else if (ch === ';' && depth === 0) {break;}
        else if (ch === '}' && depth === 0) {break;}
      }
      k++;
    }
    // Replace value segment with newVal
    out += ' ' + newVal;
    if (k < css.length && css[k] === ';') {
      out += ';';
      let next = k + 1;
      // consume extra consecutive semicolons (fixes previous ;; corruption)
      while (next < css.length && css[next] === ';') {next++;}
      cursor = next;
    } else {
      cursor = k;
    }
  }
  return out;
}

// ── Colors.css canonical helpers ─────────────────────────────────────────
function normalizeToCssFileValue(k: string, v: string): string {
  if ((k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') && typeof v === 'string') {
    const m = v.match(/url\(["']?backgrounds\/([^"')]+)["']?\)/i);
    if (m) {return 'url("../backgrounds/' + m[1] + '")';}
    // also handle already-../ case keep as is
    const m2 = v.match(/url\(["']?\.\.\/backgrounds\/([^"')]+)["']?\)/i);
    if (m2) {return 'url("../backgrounds/' + m2[1] + '")';}
  }
  return v;
}
function normalizeFromCssFileValue(k: string, v: string): string {
  if ((k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') && typeof v === 'string') {
    const m = v.match(/url\(["']?\.\.\/backgrounds\/([^"')]+)["']?\)/i);
    if (m) {return 'url("backgrounds/' + m[1] + '")';}
  }
  return v;
}
function parseColorsCssFile(): Record<string, string> {
  const cssPath = path.join(profilePath, 'css.files', 'colors.css');
  try {
    const content = fs.readFileSync(cssPath, 'utf8');
    const values: Record<string, string> = {};
    const re = /(--ftr10-[\w-]+)\s*:\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const key = m[1].trim();
      let val = m[2].trim();
      val = normalizeFromCssFileValue(key, val);
      values[key] = val;
    }
    return values;
  } catch { return {}; }
}
function regenerateColorsCss(values: Record<string, string>): void {
  const cssPath = path.join(profilePath, 'css.files', 'colors.css');
  const header = `/* FTR10 Codex — Token Definitions (auto-generated, do not edit manually — use Theme Editor) */\n:root {\n`;
  const lines = Object.entries(values)
    .filter(([k]) => k.startsWith('--ftr10-'))
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => {
      const out = normalizeToCssFileValue(k, v);
      return `  ${k}: ${out};`;
    });
  const content = header + lines.join('\n') + '\n}\n';
  try {
    const existing = fs.existsSync(cssPath) ? fs.readFileSync(cssPath,'utf8') : '';
    if (existing !== content) {fs.writeFileSync(cssPath, content);}
  } catch { fs.writeFileSync(cssPath, content); }
}
function syncAllFromColorsCss(): void {
  // Canonical source: colors.css -> everything else
  if (_togglingTheme) {return;}
  let parsed: Record<string, string> = {};
  try { parsed = parseColorsCssFile(); } catch {}
  if (Object.keys(parsed).length === 0) {return;}
  // Merge into themeConfig (colors.css wins)
  themeConfig.values = { ...themeConfig.values, ...parsed };
  // Write derived artifacts from canonical
  try {
    writeVarsJson(profilePath, { ...themeConfig, values: themeConfig.values });
    generateShim(profilePath, { ...themeConfig, values: themeConfig.values });
    writeTerminalColors(profilePath, themeConfig.values);
    writeThemeTokenColors(themeConfig.values);
    writeTokenColors(themeConfig.values);
  } catch(e) { console.error('syncAllFromColorsCss failed', e); }
  pushVarsLive(themeConfig.values);
  updateWebviewUI();
  try { if (CodexPanel) { CodexPanel.webview.postMessage({ command: 'syncVars', values: themeConfig.values }); } } catch {}
  // Preserve in-memory sessions/sections
  try {
    const themeJsonPath = path.join(profilePath, 'theme.json');
    fs.writeFileSync(themeJsonPath, JSON.stringify({
      ftr10Variables: { sections: themeConfig.sections, values: themeConfig.values },
      cssImports: themeConfig.cssImports,
      customCss: themeConfig.customCss,
      activePreset: themeConfig.activePreset,
      presetCustomizations: themeConfig.presetCustomizations,
      presetBackgroundMode: themeConfig.presetBackgroundMode,
      architectSessions: themeConfig.architectSessions,
      lastModified: Date.now()
    }, null, 2));
  } catch {}
}
function updateColorsCssWithValues(newVals: Record<string, string>): void {
  const current = parseColorsCssFile();
  const merged = { ...current, ...newVals };
  regenerateColorsCss(merged);
  // Immediately sync derived files from the new canonical
  syncAllFromColorsCss();
}

function updateAllCssFiles(values: Record<string, string>, changedKeys?: string[]): void {
  const cssDir = path.join(profilePath, 'css.files');
  if (!fs.existsSync(cssDir)) {return;}
  // colors.css is fully regenerated for cleanliness
  regenerateColorsCss(values);

  const keysToUpdate = changedKeys && changedKeys.length ? changedKeys : Object.keys(values).filter(k=>k.startsWith('--ftr10-'));
  if (keysToUpdate.length===0) {return;}
  let files: string[] = [];
  try { files = fs.readdirSync(cssDir).filter(f=>f.endsWith('.css') && f!=='colors.css'); } catch { return; }
  for (const file of files) {
    const fp = path.join(cssDir, file);
    try {
      let css = fs.readFileSync(fp,'utf8');
      let changed = false;
      let newCss = css;
      for (const key of keysToUpdate) {
        if (!newCss.includes(key)) {continue;}
        const before = newCss;
        let v = values[key];
        if ((key === '--ftr10-bg-image' || key === '--ftr10-bg-image-panels') && typeof v === 'string') {
          const m = v.match(/url\(["']?backgrounds\/([^"')]+)["']?\)/i);
          if (m) {v = 'url("../backgrounds/' + m[1] + '")';}
        }
        newCss = replaceCssVarRobust(newCss, key, v);
        if (before !== newCss) {changed = true;}
      }
      if (changed && newCss !== css) {fs.writeFileSync(fp, newCss);}
    } catch {}
  }
}

// Legacy entry kept for call sites that still expect writeColorsCss — now delegates to full updater
function writeColorsCss(values: Record<string, string>, changedKeys?: string[]): void {
  updateAllCssFiles(values, changedKeys);
}

// Returns the factory background mode for a preset.
// Presets that specify an opaque --ftr10-bg in their overrides default to 'solid'.
// Everything else defaults to 'effects' (transparent bg + Thpace active).
function getDefaultBgMode(presetId: string): 'effects' | 'solid' {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (!preset) {return 'effects';}
  return '--ftr10-bg' in preset.overrides ? 'solid' : 'effects';
}

function getPresetBgMode(presetId: string): 'effects' | 'solid' {
  return themeConfig.presetBackgroundMode[presetId] ?? getDefaultBgMode(presetId);
}

function getBasePresetValues(presetId: string): Record<string, string> {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  return { ...DEFAULT_VALUES, ...(preset?.overrides || {}) };
}

function applyPreset(presetId: string): void {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (!preset) {return;}

  const baseValues = getBasePresetValues(presetId);
  const userCustomizations = themeConfig.presetCustomizations[presetId] || {};
  const values = { ...baseValues, ...userCustomizations };

  // Apply background mode — wins over preset base, but respects explicit user customizations
  const mode = getPresetBgMode(presetId);
  const hasBgCustom = '--ftr10-bg' in userCustomizations;
  if (mode === 'effects') {
    if (!hasBgCustom) { values['--ftr10-bg'] = '#00000000'; }
    if (!('--ftr10-thpace-enabled' in userCustomizations)) { values['--ftr10-thpace-enabled'] = 'true'; }
  } else {
    // Restore the preset's own opaque bg (or solidBg fallback, or global default)
    if (!hasBgCustom) {
      const presetBg = preset.overrides['--ftr10-bg'] || preset.solidBg || DEFAULT_VALUES['--ftr10-bg'];
      values['--ftr10-bg'] = presetBg;
      if (!('--ftr10-bg-editor' in userCustomizations)) { values['--ftr10-bg-editor'] = presetBg; }
    }
    if (!('--ftr10-thpace-enabled' in userCustomizations)) { values['--ftr10-thpace-enabled'] = 'false'; }
    if (!preset.overrides['--ftr10-bg-effect'] && !('--ftr10-bg-effect' in userCustomizations)) {
      values['--ftr10-bg-effect'] = 'none';
    }
  }

  themeConfig.values = values;
  themeConfig.activePreset = presetId;
  persistThemeConfig();
  sourceP10kInTerminals();
  sidebarProvider?.syncActivePreset();
  CodexPanel?.webview.postMessage({ command: 'activePresetChanged', activePreset: presetId });
  const customCount = Object.keys(userCustomizations).length;
  const modeLabel = mode === 'effects' ? '✦ Effects' : '▣ Solid';
  const msg = customCount > 0
    ? `Theme "${preset.name}" applied [${modeLabel}] (${customCount} custom edit${customCount === 1 ? '' : 's'} restored).`
    : `Theme "${preset.name}" applied [${modeLabel}].`;
  vscode.window.showInformationMessage(msg);
}

// ═══════════════════════════════════════════════════════════════════
// Sidebar WebviewView Provider
// ═══════════════════════════════════════════════════════════════════

class ThemeSidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getSidebarHtml(themeConfig.activePreset, themeConfig.values['--ftr10-accent-1']);

    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible && CodexPanel) {
        CodexPanel.dispose();
      }
    }, undefined, this._context.subscriptions);

    webviewView.webview.onDidReceiveMessage((msg: any) => {
      if (msg.command === 'applyCard') {
        applyArchitectSession(msg.sessionId);
      }
      if (msg.command === 'applyPreset') {
        applyPreset(msg.presetId);
      }
      if (msg.command === 'editCard') {
        createCodexPanel(this._context, msg.sessionId);
      }
      if (msg.command === 'deleteCard') {
        const id: string = msg.sessionId;
        const sess = themeConfig.architectSessions[id];
        if (sess?.isBase) {
          vscode.window.showWarningMessage('Base cards cannot be deleted — use Reset ↺ to restore defaults.');
          return;
        }
        delete themeConfig.architectSessions[id];
        persistThemeConfig();
        this.syncSessions();
      }
      if (msg.command === 'resetBaseCard') {
        resetBaseSession(msg.sessionId);
      }
      if (msg.command === 'toggleBackgroundMode') {
        handleMessage(msg);
      }
      if (msg.command === 'openCodex') {
        createCodexPanel(this._context);
      }
    }, undefined, this._context.subscriptions);
  }

  syncSessions(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'syncSessions',
        cardsHtml: buildSessionCardsHtml(),
        accentColor: themeConfig.values['--ftr10-accent-1'] || ''
      });
      // Also re-sync active state so the badge reflects any preset changes
      this._view.webview.postMessage({
        command: 'syncActive',
        activePreset: themeConfig.activePreset || '',
        accentColor: themeConfig.values['--ftr10-accent-1'] || ''
      });
    }
  }

  syncActivePreset(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'syncActive',
        activePreset: themeConfig.activePreset || '',
        accentColor: themeConfig.values['--ftr10-accent-1'] || ''
      });
    }
  }

  syncBgModes(): void {
    if (this._view) {
      const bgModeMap: Record<string, string> = {};
      for (const s of Object.values(themeConfig.architectSessions)) {
        const presetId = `arch-${s.id}`;
        bgModeMap[presetId] = getPresetBgMode(presetId);
      }
      this._view.webview.postMessage({ command: 'syncBgModes', bgModeMap });
    }
  }

  pushVars(values: Record<string, string>): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'relayVars', cssVars: values });
    }
  }

  pushCodexColors(colors: string[]): void {
    if (this._view) {
      this._view.webview.postMessage({ command: 'CodexColors', colors });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// Editor panel message handling
// ═══════════════════════════════════════════════════════════════════

function handleMessage(msg: any): void {
  if (msg.command === 'getConfig') {
    if (panel) {
      const bgModeMap: Record<string, string> = {};
      for (const p of THEME_PRESETS) {
        bgModeMap[p.id] = getPresetBgMode(p.id);
      }
      panel.webview.postMessage({
        command: 'sync',
        config: themeConfig,
        simpleGroups: SIMPLE_GROUPS,
        presets: THEME_PRESETS,
        bgModeMap
      });
      setTimeout(() => {
        if (panel) {
          panel.webview.postMessage({
            command: 'sync',
            config: themeConfig,
            simpleGroups: SIMPLE_GROUPS,
            presets: THEME_PRESETS,
            bgModeMap
          });
        }
      }, 500);
    }
    return;
  }

  if (msg.command === 'toggleBackgroundMode') {
    const presetId: string = msg.presetId || themeConfig.activePreset || '';
    if (!presetId) {return;}
    const current = getPresetBgMode(presetId);
    const next: 'effects' | 'solid' = current === 'effects' ? 'solid' : 'effects';
    themeConfig.presetBackgroundMode[presetId] = next;
    if (presetId === themeConfig.activePreset) {
      applyPreset(presetId);
    } else {
      persistThemeConfig();
    }
    if (panel) {
      const bgModeMap: Record<string, string> = {};
      for (const p of THEME_PRESETS) { bgModeMap[p.id] = getPresetBgMode(p.id); }
      panel.webview.postMessage({ command: 'syncBgMode', bgModeMap, activePreset: themeConfig.activePreset });
    }
    sidebarProvider?.syncBgModes();
    return;
  }

  if (msg.command === 'liveUpdate') {
    const prevValues = themeConfig.values;
    const newValues = msg.values || themeConfig.values;
    const presetId = msg.activePreset ?? themeConfig.activePreset;
    themeConfig = {
      sections: msg.sections || themeConfig.sections,
      values: newValues,
      cssImports: msg.cssImports || themeConfig.cssImports,
      customCss: msg.customCss ?? themeConfig.customCss,
      activePreset: presetId,
      presetCustomizations: themeConfig.presetCustomizations,
      presetBackgroundMode: themeConfig.presetBackgroundMode,
      architectSessions: themeConfig.architectSessions
    };
    if (presetId) {
      const baseValues = getBasePresetValues(presetId);
      const diff: Record<string, string> = {};
      for (const [key, val] of Object.entries(newValues)) {
        if (baseValues[key] !== val) { diff[key] = val as string; }
      }
      if (Object.keys(diff).length > 0) {
        themeConfig.presetCustomizations[presetId] = diff;
      } else {
        delete themeConfig.presetCustomizations[presetId];
      }
    }
    // compute changed keys for surgical CSS update (major lag fix + data URI support)
    const changedKeys: string[] = [];
    for (const k of Object.keys(newValues)) {
      if (prevValues[k] !== newValues[k]) {changedKeys.push(k);}
    }
    try {
      persistThemeConfig({ fast: true, changedKeys });
    } catch (e: any) {
      const msgTxt = (e && e.message) ? e.message : String(e);
      console.error('[FTR10] liveUpdate persistThemeConfig failed:', e);
      vscode.window.showErrorMessage('FTR10 live-update failed: ' + msgTxt);
    }
    sidebarProvider?.syncActivePreset();
    return;
  }

  if (msg.command === 'apply') {
    const newValues = msg.values || themeConfig.values;
    const presetId = msg.activePreset ?? themeConfig.activePreset;
    themeConfig = {
      sections: msg.sections || themeConfig.sections,
      values: newValues,
      cssImports: msg.cssImports || themeConfig.cssImports,
      customCss: msg.customCss ?? themeConfig.customCss,
      activePreset: presetId,
      presetCustomizations: themeConfig.presetCustomizations,
      presetBackgroundMode: themeConfig.presetBackgroundMode,
      architectSessions: themeConfig.architectSessions
    };

    // Diff current values against the base preset to find user customizations
    if (presetId) {
      const baseValues = getBasePresetValues(presetId);
      const diff: Record<string, string> = {};
      for (const [key, val] of Object.entries(newValues)) {
        if (baseValues[key] !== val) {
          diff[key] = val as string;
        }
      }
      if (Object.keys(diff).length > 0) {
        themeConfig.presetCustomizations[presetId] = diff;
      } else {
        delete themeConfig.presetCustomizations[presetId];
      }
    }

    persistThemeConfig();
    sidebarProvider?.syncActivePreset();
    sourceP10kInTerminals();
    vscode.window.showInformationMessage('Theme applied.');
    return;
  }

  if (msg.command === 'reset') {
    const presetId = themeConfig.activePreset;
    if (presetId) {
      // Clear customizations for the active preset, re-apply it fresh
      delete themeConfig.presetCustomizations[presetId];
      const baseValues = getBasePresetValues(presetId);
      themeConfig.values = baseValues;
    } else {
      // No active preset — full reset to defaults
      const defaults = buildDefaultConfig();
      const fresh = flattenConfig(defaults);
      themeConfig.sections = fresh.sections;
      themeConfig.values = fresh.values;
      themeConfig.cssImports = fresh.cssImports;
      themeConfig.customCss = fresh.customCss;
      themeConfig.activePreset = fresh.activePreset;
    }
    persistThemeConfig();
    if (panel) {panel.webview.html = getEditorHtml(themeConfig);}
    sidebarProvider?.syncActivePreset();
    const presetName = THEME_PRESETS.find(p => p.id === presetId)?.name || 'defaults';
    vscode.window.showInformationMessage(`Theme reset to ${presetName} defaults.`);
    return;
  }

  if (msg.command === 'applyPreset') {
    applyPreset(msg.presetId);
    return;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Persistence
// ═══════════════════════════════════════════════════════════════════

function persistThemeConfig(opts?: { fast?: boolean; changedKeys?: string[] }): void {
  if (_togglingTheme) {return;}
  const isFast = !!opts?.fast;
  // Sanitize
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(themeConfig.values)) {
    let val = String(v);
    if (k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') {
      if (/^\s*url\(["']?\s*file:\/\//i.test(val)) {val = 'none';}
      if (val.length > 100000 && val.includes('data:')) {
        const bgDir = path.join(profilePath, 'backgrounds');
        try {
          const first = fs.readdirSync(bgDir).filter(f=>/\.(png|jpe?g|gif|webp|svg)$/i.test(f)).sort()[0];
          if (first) {val = 'url("backgrounds/' + first + '")';}
          else {val = 'none';}
        } catch { val = 'none'; }
      }
    }
    values[k] = val;
  }
  themeConfig.values = values;
  // Canonical: colors.css is source of truth -> write it first
  try { regenerateColorsCss(values); } catch(e){ console.error('regenerateColorsCss failed', e); }
  // Fast path: just sync derived files from canonical
  if (isFast) {
    try {
      // update other css files that contain changed keys (main.css etc) but keep colors.css canonical
      const cssDir = path.join(profilePath, 'css.files');
      if (fs.existsSync(cssDir) && opts?.changedKeys) {
        // still update auxiliary css files via updateAllCssFiles logic but without overwriting colors.css again
        // we already wrote colors.css, so only update others
        let files: string[] = [];
        try { files = fs.readdirSync(cssDir).filter(f=>f.endsWith('.css') && f!=='colors.css'); } catch {}
        for (const file of files) {
          const fp = path.join(cssDir, file);
          try {
            let css = fs.readFileSync(fp,'utf8');
            let newCss = css;
            for (const key of opts.changedKeys) {
              if (!newCss.includes(key)) {continue;}
              let v = values[key];
              if ((key === '--ftr10-bg-image' || key === '--ftr10-bg-image-panels') && typeof v === 'string') {
                const m = v.match(/url\(["']?backgrounds\/([^"')]+)["']?\)/i);
                if (m) {v = 'url("../backgrounds/' + m[1] + '")';}
              }
              newCss = replaceCssVarRobust(newCss, key, v);
            }
            if (newCss !== css) {fs.writeFileSync(fp, newCss);}
          } catch {}
        }
      }
      writeVarsJson(profilePath, { ...themeConfig, values });
      generateShim(profilePath, { ...themeConfig, values });
      pushVarsLive(values);
      updateWebviewUI();
      // Sync vars panel after palette finalize (delayed to avoid breaking wheel during drag)
      try { setTimeout(() => { try { if (CodexPanel) {CodexPanel.webview.postMessage({ command: 'syncVars', values });} } catch {} }, 150); } catch {}
      // keep theme.json in sync - use in-memory config (preserves sessions)
      try {
        const themeJsonPath = path.join(profilePath, 'theme.json');
        fs.writeFileSync(themeJsonPath, JSON.stringify({
          ftr10Variables: { sections: themeConfig.sections, values },
          cssImports: themeConfig.cssImports,
          customCss: themeConfig.customCss,
          activePreset: themeConfig.activePreset,
          presetCustomizations: themeConfig.presetCustomizations,
          presetBackgroundMode: themeConfig.presetBackgroundMode,
          architectSessions: themeConfig.architectSessions,
          lastModified: Date.now()
        }, null, 2));
      } catch {}
      return;
    } catch(e){ console.error('fast persist failed', e); }
  }
  // Full sync from canonical colors.css
  try { syncAllFromColorsCss(); } catch(e){ console.error('syncAllFromColorsCss failed', e); }
  // Also ensure auxiliary css files updated for changed keys
  if (opts?.changedKeys) {
    try { writeColorsCss(values, opts.changedKeys); } catch {}
  }
}

function pushVarsLive(values: Record<string, string>): void {
  const msg = { command: 'relayVars', cssVars: values };
  // Relay to every currently-open webview panel (Theme Editor AND Architect).
  // The webview scripts forward relayVars onto BroadcastChannel('theme-sync'),
  // which the injected shim listens on and applies live — no dependency on the
  // workbench's fetch() being able to reach vars.json across window origins.
  for (const vw of livePanels) {
    try { vw.webview.postMessage(msg); } catch (_) {}
  }
  sidebarProvider?.pushVars(values);
}

function sourceP10kInTerminals(): void {
  const active = vscode.window.activeTerminal;
  if (active) {
    active.sendText('source ~/.p10k.zsh 2>/dev/null || true', true);
  }
}

function toHex6(hex: string): string {
  const m = (hex || '').replace(/\s/g, '').match(/^#([0-9a-fA-F]{6})/);
  return m ? '#' + m[1] : hex;
}

/** Resolve a var() chain within the theme values dict, then strip to 6-digit hex. */
function resolveTokenColor(raw: string, values: Record<string, string>, depth = 0): string {
  if (!raw || depth > 8) {return raw;}
  const varRef = raw.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*?))?\s*\)$/);
  if (varRef) {
    const resolved = values[varRef[1]];
    const fallback = varRef[2]?.trim() || raw;
    return resolveTokenColor(resolved || fallback, values, depth + 1);
  }
  return toHex6(raw);
}

// Maps token rule names (from tokens.json) to --ftr10-token-* CSS vars
// 1:1 map — every named rule in tokens.json gets its own --ftr10-token-* var
const TOKEN_NAME_MAP: Record<string, string> = {
  // Core language
  'String':                                 '--ftr10-token-string',
  'String Escape':                          '--ftr10-token-string-escape',
  'Number':                                 '--ftr10-token-number',
  'Boolean':                                '--ftr10-token-boolean',
  'Variable':                               '--ftr10-token-variable',
  'Other Keyword':                          '--ftr10-token-keyword-other',
  'Keyword':                                '--ftr10-token-keyword',
  'Keyword Control':                        '--ftr10-token-keyword-control',
  'Constant keywords':                      '--ftr10-token-constant',
  'Constant Placeholder':                   '--ftr10-token-constant-placeholder',
  'Function call':                          '--ftr10-token-function',
  'Function Call':                          '--ftr10-token-function',
  'Function definition':                    '--ftr10-token-function-def',
  'Entity name':                            '--ftr10-token-function',
  'Storage':                                '--ftr10-token-storage',
  'Modules':                                '--ftr10-token-module',
  'Type':                                   '--ftr10-token-type',
  'Comment':                                '--ftr10-token-comment',
  'Class':                                  '--ftr10-token-class',
  'Class variable':                         '--ftr10-token-class-variable',
  'Class method':                           '--ftr10-token-class-method',
  'Punctuation':                            '--ftr10-token-punctuation',
  'Template expression':                    '--ftr10-token-template',
  'Namespaces':                             '--ftr10-token-namespace',
  'Blocks':                                 '--ftr10-token-block',
  'Markup Deleted':                         '--ftr10-token-markup-deleted',
  'Markup Inserted':                        '--ftr10-token-markup-inserted',
  // YAML / JSON
  'YAML key':                               '--ftr10-token-yaml-key',
  'JSON key':                               '--ftr10-token-json-key',
  'JSON constant':                          '--ftr10-token-json-constant',
  'JSON Key - Level 0':                     '--ftr10-token-json-0',
  'JSON Key - Level 1':                     '--ftr10-token-json-1',
  'JSON Key - Level 2':                     '--ftr10-token-json-2',
  'JSON Key - Level 3':                     '--ftr10-token-json-3',
  'JSON Key - Level 4':                     '--ftr10-token-json-4',
  'JSON Key - Level 5':                     '--ftr10-token-json-5',
  'Key - Level 6':                          '--ftr10-token-json-6',
  'JSON Key - Level 7':                     '--ftr10-token-json-7',
  'JSON Key - Level 8':                     '--ftr10-token-json-8',
  // CSS
  'CSS class':                              '--ftr10-token-css-class',
  'CSS ID':                                 '--ftr10-token-css-id',
  'CSS tag':                                '--ftr10-token-css-tag',
  'CSS properties':                         '--ftr10-token-css-property',
  // HTML
  'HTML tag outer':                         '--ftr10-token-html-outer',
  'HTML tag inner':                         '--ftr10-token-html-inner',
  'HTML tag attribute':                     '--ftr10-token-html-attribute',
  'HTML entities':                          '--ftr10-token-html-entity',
  // Markdown — mapped to the same palette vars as MonacoUnderlay uses so both sides match
  'Markdown heading':                       '--ftr10-h1-color',
  'Markdown link text':                     '--ftr10-accent-1',
  'Markdown list item':                     '--ftr10-h1-color',
  'Markdown italic':                        '--ftr10-em-color',
  'Markdown bold':                          '--ftr10-strong-color',
  'Markdown bold italic':                   '--ftr10-strong-color',
  'Markdown code block':                    '--ftr10-accent-2',
  'Markdown inline code':                   '--ftr10-accent-2',
  'Markdown - Blockquote':                  '--ftr10-text-muted',
  'Markdown - Blockquote Punctuation':      '--ftr10-accent-3',
  'Markdown - Fenced Language':             '--ftr10-accent-2',
  // INI
  'INI property name':                      '--ftr10-token-ini-property',
  'INI section title':                      '--ftr10-token-ini-section',
  // C#
  'C# class':                               '--ftr10-token-cs-class',
  'C# class method':                        '--ftr10-token-cs-method',
  'C# function call':                       '--ftr10-token-cs-function',
  'C# type':                                '--ftr10-token-cs-type',
  'C# return type':                         '--ftr10-token-cs-return',
  'C# preprocessor':                        '--ftr10-token-cs-preprocessor',
  'C# namespace':                           '--ftr10-token-cs-namespace',
  // JSX
  'JSX Text':                               '--ftr10-token-jsx-text',
  'JSX Components name':                    '--ftr10-token-jsx-component',
  // Python
  'Member Access Meta':                     '--ftr10-token-py-member',
  'Python - Self Parameter':                '--ftr10-token-py-self',
  'Python - Format Placeholder':            '--ftr10-token-py-format',
  // C/C++
  'C-related Block Level Variables':        '--ftr10-token-cpp-variable',
};

// 1:1 map — each semantic token key in tokens.json gets its own --ftr10-token-* var
const SEMANTIC_TOKEN_MAP: Record<string, string> = {
  'class':                     '--ftr10-token-class',
  'class.declaration':         '--ftr10-token-class',
  'class.typeHint.builtin':    '--ftr10-token-type',
  'comment':                   '--ftr10-token-comment',
  'enumMember':                '--ftr10-token-variable',
  'function':                  '--ftr10-token-function',
  'module':                    '--ftr10-token-module',
  'number':                    '--ftr10-token-number',
  'parameter.declaration':     '--ftr10-token-variable',
  'selfParameter':             '--ftr10-token-py-self',
  'selfParameter.declaration': '--ftr10-token-py-self',
  'string':                    '--ftr10-token-string',
  'type':                      '--ftr10-token-type',
  'typeParameter':             '--ftr10-token-type',
  'variable':                  '--ftr10-token-variable',
  'variable.constant':         '--ftr10-token-variable',
  'variable.defaultLibrary':   '--ftr10-token-variable',
  'variable.readonly':         '--ftr10-token-variable',
};

/**
 * Write resolved markdown (and all other) token colors into the bundled
 * ftr10-base-color-theme.json file. VS Code picks up the change automatically
 * when the file on disk changes — no settings.json writes needed.
 */
function writeThemeTokenColors(values: Record<string, string>): void {
  const themePath = path.join(extensionRoot, 'themes', 'ftr10-base-color-theme.json');
  let theme: any;
  try {
    theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
  } catch (_) { return; }

  const tokensPath = path.join(profilePath, 'css.files', 'tokens.json');
  let tokens: any;
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  } catch (_) { return; }

  // Build textMateRules from tokens.json with resolved colors
  const textMateRules = (tokens.tokenColors as any[])
    .filter((r: any) => r.scope)
    .map((rule: any) => {
      const varName = TOKEN_NAME_MAP[rule.name];
      const color = varName ? resolveTokenColor(values[varName] || '', values) : null;
      const fontStyle: string = rule.settings.fontStyle ?? '';
      const settings: Record<string, string> = { fontStyle };
      if (color) {
        settings.foreground = color;
      } else if (rule.settings.foreground) {
        settings.foreground = rule.settings.foreground;
      }
      return { scope: rule.scope, settings };
    });

  // Build semantic token rules
  const semanticRules: Record<string, string> = {};
  const baseSemantic: Record<string, string> = tokens.semanticTokenColors || {};
  for (const [token, defaultColor] of Object.entries(baseSemantic)) {
    const varName = SEMANTIC_TOKEN_MAP[token];
    semanticRules[token] = varName
      ? resolveTokenColor(values[varName] || String(defaultColor), values)
      : String(defaultColor);
  }

  theme.tokenColors = textMateRules;
  theme.semanticTokenColors = semanticRules;
  theme.semanticHighlighting = true;

  try {
    fs.writeFileSync(themePath, JSON.stringify(theme, null, 2));
  } catch (_) { /* non-fatal */ return; }
}

function writeTokenColors(values: Record<string, string>): void {
  const tokensPath = path.join(profilePath, 'css.files', 'tokens.json');
  let tokens: any;
  try {
    tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  } catch (_) { return; /* tokens.json missing or invalid — skip silently */ }

  // Build textMateRules: substitute --ftr10-token-* values where mapped, keep originals otherwise.
  // Always emit an explicit fontStyle so the active VS Code color theme cannot bleed italic/bold
  // onto scopes FTR10 controls. Intentional styles set in tokens.json (e.g. Markdown bold/italic)
  // are preserved; everything else is reset to '' to guarantee a clean slate.
  const textMateRules = (tokens.tokenColors as any[])
    .filter((r: any) => r.scope) // skip the Global settings entry (no scope)
    .map((rule: any) => {
      const varName = TOKEN_NAME_MAP[rule.name];
      const color = varName ? resolveTokenColor(values[varName] || '', values) : null;
      const fontStyle: string = rule.settings.fontStyle ?? '';
      const settings: Record<string, string> = { fontStyle };
      if (color) {
        settings.foreground = color;
      } else if (rule.settings.foreground) {
        settings.foreground = rule.settings.foreground;
      }
      return { scope: rule.scope, settings };
    });

  // Build semantic token rules
  const semanticRules: Record<string, string> = {};
  const baseSemantic: Record<string, string> = tokens.semanticTokenColors || {};
  for (const [token, defaultColor] of Object.entries(baseSemantic)) {
    const varName = SEMANTIC_TOKEN_MAP[token];
    semanticRules[token] = varName ? resolveTokenColor(values[varName] || String(defaultColor), values) : String(defaultColor);
  }

  vscode.workspace.getConfiguration('editor').update(
    'tokenColorCustomizations',
    { textMateRules },
    vscode.ConfigurationTarget.Global
  );
  vscode.workspace.getConfiguration('editor').update(
    'semanticTokenColorCustomizations',
    { rules: semanticRules, enabled: true },
    vscode.ConfigurationTarget.Global
  );
}

function writeTerminalColors(profilePathArg: string, values: Record<string, string>): void {
  const a1 = toHex6(values['--ftr10-accent-1'] || '#7c3aed');
  const a2 = toHex6(values['--ftr10-accent-2'] || '#06b6d4');
  const a3 = toHex6(values['--ftr10-accent-3'] || '#f43f5e');
  const content = [
    '# FTR10 terminal accent colors — auto-generated, do not edit manually',
    `export FTR10_ACCENT1='${a1}'`,
    `export FTR10_ACCENT2='${a2}'`,
    `export FTR10_ACCENT3='${a3}'`,
  ].join('\n') + '\n';
  try {
    fs.writeFileSync(path.join(profilePathArg, 'terminal-colors.zsh'), content);
  } catch (_) { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════════
// Panel management
// ═══════════════════════════════════════════════════════════════════

function createPanel(context: vscode.ExtensionContext): void {
  panel = vscode.window.createWebviewPanel('themeSyncPanel', 'FTR10 Theme Editor', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.file(path.join(process.env.HOME || require('os').homedir(), '.ftr10'))]
  });
  panel.webview.html = getEditorHtml(themeConfig);
  const _panelRef = panel;
  panel.onDidDispose(() => { unregisterLivePanel(_panelRef); panel = undefined; }, null, context.subscriptions);
  registerLivePanel(panel);
  panel.webview.onDidReceiveMessage(handleMessage, undefined, context.subscriptions);
}

function updateWebviewUI(): void {
  if (panel) {
    const bgModeMap: Record<string, string> = {};
    for (const p of THEME_PRESETS) { bgModeMap[p.id] = getPresetBgMode(p.id); }
    let bgImages: { name: string; dataUri: string }[] = [];
    // Strip oversized/data-URI blobs so the sidebar webview message stays under VS Code's cap
    const safeCfg = sanitizeConfigForWebview(themeConfig);
    panel.webview.postMessage({
      command: 'sync',
      config: safeCfg,
      simpleGroups: SIMPLE_GROUPS,
      presets: THEME_PRESETS,
      bgModeMap,
      bgImages
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// CSS / Shim generation
// ═══════════════════════════════════════════════════════════════════

function writeVarsJson(profilePathArg: string, cfg: ThemeConfig): void {
  const varsPath = path.join(profilePathArg, 'vars.json');
  fs.writeFileSync(varsPath, JSON.stringify({
    values: cfg.values,
    lastModified: Date.now()
  }));
}

function buildWebviewVarsCss(cfg: ThemeConfig): string {
  const vals = cfg.values || {};
  let css = Object.keys(vals).length
    ? ':root {\n' + Object.entries(vals).map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n'
    : '';
  if (cfg.customCss) {css += '\n' + cfg.customCss + '\n';}
  return css;
}


function generateShim(profilePathArg: string, cfg: ThemeConfig): void {
  const shimPath = path.join(profilePathArg, 'shim.js');
  const baseCssFiles = cfg.cssImports?.length ? cfg.cssImports : ['css.files/colors.css', 'css.files/main.css', 'css.files/font_load.css'];
  const cssFiles = baseCssFiles.includes('css.files/effects.css') ? baseCssFiles : [...baseCssFiles, 'css.files/effects.css'];
  // CLEAN shim — based on 0422 known-good. Uses _VSCODE_FILE_ROOT which code-server sets to
  // {{WORKBENCH_WEB_BASE_URL}}/out/ at runtime, so __base correctly resolves to the workbench
  // dir where css.files/, backgrounds/, vars.json are symlinked. No canvas particle code in shim.
  const shim = `(function() {
var ID = 'theme-sync-live-style';
var el = document.getElementById(ID);
if (!el) { el = document.createElement('style'); el.id = ID; document.head.appendChild(el); }
var __base = (typeof globalThis._VSCODE_FILE_ROOT === 'string' ? globalThis._VSCODE_FILE_ROOT + 'vs/code/browser/workbench/' : new URL('./', import.meta.url).href);
var __cssFiles = ${JSON.stringify(cssFiles)};
__cssFiles.forEach(function(f) {
  var id = 'ftr10-' + f.replace(/[^a-zA-Z0-9]/g, '');
  if (!document.getElementById(id)) {
    var link = document.createElement('link');
    link.id = id; link.rel = 'stylesheet'; link.href = __base + f;
    document.head.appendChild(link);
  }
});

// Thpace: load library first, then init script sequentially.
var __thpaceLib  = 'css.files/thpace.min.js';
var __thpaceInit = 'css.files/thpace-background.js';
var __libId = 'ftr10-thpace-lib';
if (!document.getElementById(__libId)) {
  var __sLib = document.createElement('script');
  __sLib.id = __libId;
  __sLib.src = __base + __thpaceLib;
  __sLib.onload = function() {
    var __initId = 'ftr10-thpace-init';
    if (!document.getElementById(__initId)) {
      var __sInit = document.createElement('script');
      __sInit.id = __initId;
      __sInit.src = __base + __thpaceInit;
      document.head.appendChild(__sInit);
    }
  };
  document.head.appendChild(__sLib);
}

var __customScript = 'css.files/context-menu-codex.js';
var __customId = 'ftr10-context-menu-codex';
if (!document.getElementById(__customId)) {
  var __sCustom = document.createElement('script');
  __sCustom.id = __customId;
  __sCustom.src = __base + __customScript;
  document.head.appendChild(__sCustom);
}

var __defaultVars = ${JSON.stringify(cfg.values)};
function __applyEffect(vals) {
  if (!document.body) { document.addEventListener('DOMContentLoaded', function() { __applyEffect(vals); }); return; }
  var effect = ((vals && vals['--ftr10-bg-effect']) || 'none').trim().toLowerCase();
  document.body.className = (document.body.className || '').replace(/\\bftr10-effect--\\S+/g, '').trim();
  if (effect !== 'none') document.body.classList.add('ftr10-effect--' + effect);
  var oldLayer = document.getElementById('ftr10-effect-layer');
  if (oldLayer) oldLayer.remove();
}
var applyVars = function(vars) {
  // Resolve tiny url("backgrounds/file") to absolute __base + backgrounds/file so injected style works
  // and we avoid storing 1MB data URIs in vars.json (polling lag fix)
  var resolved = {};
  for (var k in vars) {
    var v = vars[k];
    if ((k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') && typeof v === 'string') {
      var bm = v.match(/url\\(["']?backgrounds\\/([^"')]+)["']?\\)/i) || v.match(/url\\(["']?\\.\\.\\/backgrounds\\/([^"')]+)["']?\\)/i);
      if (bm) v = 'url("' + __base + 'backgrounds/' + (bm[1] || bm[2] || '') + '")';
    }
    resolved[k] = v;
  }
  el.textContent = ':root {\\n' + Object.entries(resolved).map(function(kv) { return ' ' + kv[0] + ': ' + kv[1] + ' !important;'; }).join('\\n') + '\\n}';
  __applyEffect(resolved);
  if (window.ftr10Thpace) {
    var thpaceOn = (vars['--ftr10-thpace-enabled'] || 'true').trim() !== 'false';
    thpaceOn ? window.ftr10Thpace.enable() : window.ftr10Thpace.disable();
  }
};
applyVars(__defaultVars);

// Poll vars.json for live updates from the extension host.
// __base uses _VSCODE_FILE_ROOT which maps to {{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/
// where vars.json is symlinked — no need for candidate bases fallback.
var __lastMod = 0;
var __pollTimer = null;
var __burstUntil = 0;
function __pollVars() {
  fetch(__base + 'vars.json?t=' + Date.now())
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data && data.lastModified && data.lastModified !== __lastMod) {
        __lastMod = data.lastModified;
        __burstUntil = Date.now() + 8000;
        if (data.values) applyVars(data.values);
      }
    })
    .catch(function() {})
    .finally(function() {
      __pollTimer = setTimeout(__pollVars, Date.now() < __burstUntil ? 1500 : 30000);
    });
}
__pollTimer = setTimeout(__pollVars, 1000);

try {
  var __ch = new BroadcastChannel('theme-sync');
  __ch.onmessage = function(e) {
    var d = e.data || {};
    if (d.cssVars) applyVars(d.cssVars);
  };
} catch(e) {}
window.addEventListener('message', function(e) {
  if (e.data?.type === 'theme-sync-update' && e.data.cssVars) applyVars(e.data.cssVars);
});
})();`;
  fs.writeFileSync(shimPath, shim);
}

// ═══════════════════════════════════════════════════════════════════
// Workbench patching
// ═══════════════════════════════════════════════════════════════════

async function patchWorkbench(profilePathArg: string): Promise<void> {
  const workbenchDir = '/usr/lib/code-server/lib/vscode/out/vs/code/browser/workbench';
  const workbenchHtmlPath = path.join(workbenchDir, 'workbench.html');
  const shimSrcPath = path.join(profilePathArg, 'shim.js');
  const shimLinkPath = path.join(workbenchDir, 'shim.js');
  try {
    if (!fs.existsSync(shimSrcPath)) {
      vscode.window.showErrorMessage('shim.js not found');
      return;
    }
    if (fs.existsSync(shimLinkPath) || (fs.existsSync(shimLinkPath) && fs.lstatSync(shimLinkPath).isSymbolicLink())) {
      fs.unlinkSync(shimLinkPath);
    }
    fs.symlinkSync(shimSrcPath, shimLinkPath);

    // Symlink vars.json for live polling
    const varsSrcPath = path.join(profilePathArg, 'vars.json');
    const varsLinkPath = path.join(workbenchDir, 'vars.json');
    if (!fs.existsSync(varsSrcPath)) {
      writeVarsJson(profilePathArg, themeConfig);
    }
    try {
      if (fs.existsSync(varsLinkPath)) {fs.unlinkSync(varsLinkPath);}
    } catch (_e) { /* ignore */ }
    fs.symlinkSync(varsSrcPath, varsLinkPath);

    // Symlink the backgrounds dir so the workbench origin can serve them.
    // effects.css paints `--ftr10-bg-image: url("../backgrounds/<file>")` which
    // resolves relative to the served css.files/ location (the workbench dir).
    const bgDirSrc = path.join(profilePathArg, 'backgrounds');
    const bgDirLink = path.join(workbenchDir, 'backgrounds');
    if (fs.existsSync(bgDirSrc)) {
      try { if (fs.existsSync(bgDirLink)) {fs.unlinkSync(bgDirLink);} } catch (_e) { /* ignore */ }
      try { fs.symlinkSync(bgDirSrc, bgDirLink); } catch (_e) { /* ignore */ }
    }

    let html = fs.readFileSync(workbenchHtmlPath, 'utf8');
    // Fix (2026-07-15): correct tag is {{WORKBENCH_WEB_BASE_URL}}/.../shim.js, not ./shim.js
    // Clean up any old/broken injections first to prevent duplicates and broken relative paths.
    const CORRECT_SHIM_TAG = '<script type="module" src="{{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/shim.js"></script>';
    const SHIM_TAG_REGEX = /<script[^>]*shim\.js[^>]*>\s*<\/script>\s*/gi;
    const hadOld = SHIM_TAG_REGEX.test(html);
    if (hadOld) {
      html = html.replace(SHIM_TAG_REGEX, '');
    }
    if (!html.includes('{{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/shim.js')) {
      if (html.includes('workbench.js')) {
        html = html.replace(
          /(<script\s+type="module"\s+src="[^"]*workbench\.js"[^>]*>)/,
          `\n  ${CORRECT_SHIM_TAG}\n$1`
        );
      } else {
        html = html.replace('</head>', `  ${CORRECT_SHIM_TAG}\n</head>`);
      }
      fs.writeFileSync(workbenchHtmlPath, html);
    } else if (hadOld) {
      // We removed old tags but correct tag already existed? Ensure file is rewritten cleaned.
      fs.writeFileSync(workbenchHtmlPath, html);
      // Re-inject if we accidentally removed the correct one
      if (!html.includes('{{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/shim.js')) {
        let fresh = fs.readFileSync(workbenchHtmlPath, 'utf8');
        if (fresh.includes('workbench.js')) {
          fresh = fresh.replace(
            /(<script\s+type="module"\s+src="[^"]*workbench\.js"[^>]*>)/,
            `\n  ${CORRECT_SHIM_TAG}\n$1`
          );
        } else {
          fresh = fresh.replace('</head>', `  ${CORRECT_SHIM_TAG}\n</head>`);
        }
        fs.writeFileSync(workbenchHtmlPath, fresh);
      }
    }
    // Ensure symlink for css.files dir exists (workbench needs to serve css files)
    const cssDirSrc = path.join(profilePathArg, 'css.files');
    const cssDirLink = path.join(workbenchDir, 'css.files');
    try { if (fs.existsSync(cssDirLink)) {fs.unlinkSync(cssDirLink);} } catch {}
    try { if (fs.existsSync(cssDirSrc)) {fs.symlinkSync(cssDirSrc, cssDirLink);} } catch {}
    vscode.window.showInformationMessage('Workbench patched with shim.js');
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to patch workbench: ${err?.message || err}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Sidebar HTML
// ═══════════════════════════════════════════════════════════════════

function buildSessionCardsHtml(activePreset?: string): string {
  const all = Object.values(themeConfig.architectSessions)
    .sort((a, b) => {
      // Base cards first, ordered by preset list, then user cards by updatedAt desc
      const aIsBase = !!a.isBase; const bIsBase = !!b.isBase;
      if (aIsBase && !bIsBase) {return -1;}
      if (!aIsBase && bIsBase) {return 1;}
      if (aIsBase && bIsBase) {
        // preserve original preset order via createdAt (earlier created = earlier in list)
        return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      }
      return b.updatedAt - a.updatedAt;
    });
  if (all.length === 0) {
    return `<div class="empty-state">No saved sessions yet.<br>Open the Architect, design a palette, and click <strong>Save</strong> to create your first card.</div>`;
  }
  const gearIcon = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.7 1.3-2-.8-.9-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.5v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 14l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.5-2.4h2.8zM8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-1a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>`;
  const resetIcon = `↺`;
  return all.map(s => {
    const presetId = `arch-${s.id}`;
    const isActive = (activePreset ?? themeConfig.activePreset) === presetId;
    const c1 = escapeHtml(s.savedColors[0] || '#555555');
    const c2 = escapeHtml(s.savedColors[1] || '#555555');
    const c3 = escapeHtml(s.savedColors[2] || '#555555');
    const isBase = !!s.isBase;
    return `<div class="theme-card session-card${isActive ? ' active' : ''}${isBase ? ' base-card' : ''}" data-session-id="${escapeHtml(s.id)}" data-preset-id="${escapeHtml(presetId)}">
      <div class="card-top">
        <div class="swatches">
          <span class="swatch" style="background:${c1}"></span>
          <span class="swatch" style="background:${c2}"></span>
          <span class="swatch" style="background:${c3}"></span>
        </div>
        <div class="card-btns">
          <button class="gear-btn edit-btn" data-session-id="${escapeHtml(s.id)}" title="Edit in Architect">${gearIcon}</button>
          ${isBase ? `<button class="reset-btn" data-session-id="${escapeHtml(s.id)}" title="Reset to default">${resetIcon}</button>` : `<button class="del-btn" data-session-id="${escapeHtml(s.id)}" title="Delete session">✕</button>`}
        </div>
      </div>
      <div class="card-name">${escapeHtml(s.name)}${isBase ? ' <span class="base-badge">Base</span>' : ''}</div>
      <div class="card-desc">${escapeHtml(s.harmony)} harmony${isBase && s.basePresetId ? ` • ${escapeHtml(s.basePresetId)}` : ''}</div>
      ${isActive ? '<div class="card-active-badge">Active</div>' : ''}
    </div>`;
  }).join('');
}

// Kept for backward compat but no longer rendered as separate section — Base cards now live in session list
function buildPresetCardsHtml(_activePreset?: string): string { return ''; }

function getSidebarHtml(activePreset?: string, accentColor?: string): string {
  const accent = accentColor || '#7c3aed';
  const sessionCards = buildSessionCardsHtml(activePreset);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
<style>
  :root { --ftr10-accent-1: ${escapeHtml(accent)}; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Space Mono', monospace;
    color: var(--vscode-foreground);
    background: transparent;
    padding: 12px;
  }
  body { scrollbar-width: thin !important; scrollbar-color: #ffffff2e transparent; }
  body::-webkit-scrollbar { width: 6px !important; }
  body::-webkit-scrollbar-track { background: transparent; }
  body::-webkit-scrollbar-thumb { background: #ffffff2e; border-radius: 3px; }
  body::-webkit-scrollbar-thumb:hover { background: #ffffff52; }
  html { scrollbar-width: thin !important; scrollbar-color: #ffffff2e transparent; }
  html::-webkit-scrollbar { width: 6px !important; }
  html::-webkit-scrollbar-track { background: transparent; }
  html::-webkit-scrollbar-thumb { background: #ffffff2e; border-radius: 3px; }
  html::-webkit-scrollbar-thumb:hover { background: #ffffff52; }

  .header { margin-bottom: 14px; }
  .header h2 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 11px; opacity: 0.6; line-height: 1.5; }

  .session-list { display: flex; flex-direction: column; gap: 10px; }

  .theme-card {
    padding: 12px;
    border-radius: 10px;
    border: 1px solid var(--vscode-panel-border, #ffffff14);
    background: #ffffff0d;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    position: relative;
    font-family: var(--ftr10-font-sidebar, var(--ftr10-body-font, var(--vscode-font-family, sans-serif)));
  }
  .theme-card:hover { border-color: var(--ftr10-accent-1); opacity: 0.85; }
  .theme-card.active {
    border-color: var(--ftr10-accent-1);
    box-shadow: 0 0 0 1px var(--ftr10-accent-1),
                0 0 12px color-mix(in srgb, var(--ftr10-accent-1) 30%, transparent);
  }
  .theme-card.base-card { border-style: dashed; border-color: #ffffff22; }
  .theme-card.base-card:hover { border-color: var(--ftr10-accent-1); }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .swatches { display: flex; gap: 6px; }
  .swatch { width: 18px; height: 18px; border-radius: 50%; border: 1px solid #ffffff26; }

  .card-btns { display: flex; gap: 4px; align-items: center; }

  .gear-btn, .del-btn, .reset-btn {
    display: grid; place-items: center;
    width: 26px; height: 26px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: #ffffff0a;
    color: var(--vscode-descriptionForeground, #888);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-size: 11px;
  }
  .gear-btn:hover, .del-btn:hover, .reset-btn:hover { background: #ffffff1a; color: var(--vscode-foreground); }
  .del-btn:hover { color: #ff5c75; }
  .reset-btn:hover { color: #7bc8ff; }

  .card-name { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .card-desc { font-size: 11px; opacity: 0.55; line-height: 1.4; }

  .base-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 1px 5px; border-radius: 10px; background: #ffffff18; color: #ffffffaa; margin-left: 6px; vertical-align: middle; }

  .card-active-badge {
    position: absolute; bottom: 10px; right: 10px;
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.1em; padding: 2px 7px; border-radius: 20px;
    background: var(--ftr10-accent-1); color: white;
  }

  .bg-mode-btn {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 3px 9px;
    border-radius: 20px; border: 1px solid #ffffff20;
    background: #ffffff0a; color: var(--vscode-descriptionForeground, #888);
    font-size: 10px; font-weight: 600; cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    line-height: 1.4;
  }
  .bg-mode-btn:hover { background: #ffffff18; border-color: #ffffff38; color: var(--vscode-foreground); }
  .bg-mode-btn.effects {
    border-color: color-mix(in srgb, var(--ftr10-accent-1) 45%, transparent);
    color: var(--ftr10-accent-1);
    background: color-mix(in srgb, var(--ftr10-accent-1) 10%, transparent);
  }
  .bg-mode-btn.solid { border-color: #ffffff28; color: var(--vscode-descriptionForeground, #888); }

  /* Architect entry card */
  .arch-entry-card {
    cursor: pointer;
    margin-bottom: 14px;
    background: linear-gradient(135deg, rgba(123,104,238,0.12), rgba(0,212,255,0.07));
    border-color: rgba(123,104,238,0.3);
  }
  .arch-entry-card:hover { border-color: rgba(123,104,238,0.7); opacity: 1; }
  .arch-entry-card .card-desc { font-size: 10px; opacity: 0.45; }
  .arch-entry-swatches { display: flex; gap: 6px; margin-bottom: 8px; }
  .arch-entry-swatches .swatch { transition: background 0.3s ease; }
  .arch-entry-open {
    display: inline-flex; align-items: center; gap: 4px;
    margin-top: 8px; padding: 3px 9px; border-radius: 20px;
    border: 1px solid rgba(123,104,238,0.5);
    background: linear-gradient(135deg, rgba(123,104,238,0.15), rgba(0,212,255,0.1));
    color: rgba(200,200,255,0.9);
    font-size: 10px; font-weight: 600; pointer-events: none;
  }

  .empty-state {
    padding: 18px 12px; text-align: center;
    font-size: 11px; opacity: 0.5; line-height: 1.7;
    border: 1px dashed #ffffff18; border-radius: 10px;
  }
  .empty-state strong { opacity: 0.8; }

  .section-label {
    font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; opacity: 0.35; margin-bottom: 6px; margin-top: 10px;
  }
</style>
</head>
<body>
  <div class="header">
    <h2>FTR10 Architect</h2>
    <p>Base cards give you a starting point. They are fully editable — make them yours. Reset to restore defaults.</p>
  </div>

  <!-- Architect entry card — always visible, opens blank session -->
  <div class="theme-card arch-entry-card" id="CodexCard">
    <div class="card-top">
      <div class="arch-entry-swatches" id="dsCardSwatches">
        <span class="swatch" style="background:#7b68ee"></span>
        <span class="swatch" style="background:#00d4ff"></span>
        <span class="swatch" style="background:#ff6bca"></span>
      </div>
    </div>
    <div class="card-name">&#10022; New Session</div>
    <div class="card-desc">Open the Architect to create a new palette</div>
    <span class="arch-entry-open">Open Architect &rsaquo;</span>
  </div>

  <div class="section-label">Sessions</div>
  <div class="session-list" id="sessionList">
    ${sessionCards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const _ftr10SidebarListeners = [];
    const sessionList = document.getElementById('sessionList');
    function sessionListHandler(e) {
      const resetBtn = e.target.closest('.reset-btn');
      if (resetBtn) {
        e.stopPropagation();
        if (confirm('Reset this Base card to its factory defaults?')) {
          vscode.postMessage({ command: 'resetBaseCard', sessionId: resetBtn.getAttribute('data-session-id') });
        }
        return;
      }
      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        e.stopPropagation();
        vscode.postMessage({ command: 'editCard', sessionId: editBtn.getAttribute('data-session-id') });
        return;
      }
      const delBtn = e.target.closest('.del-btn');
      if (delBtn) {
        e.stopPropagation();
        vscode.postMessage({ command: 'deleteCard', sessionId: delBtn.getAttribute('data-session-id') });
        return;
      }
      const card = e.target.closest('.session-card');
      if (card) {
        vscode.postMessage({ command: 'applyCard', sessionId: card.getAttribute('data-session-id') });
      }
    }
    sessionList.addEventListener('click', sessionListHandler);
    _ftr10SidebarListeners.push(() => sessionList.removeEventListener('click', sessionListHandler));

    const codexCard = document.getElementById('CodexCard');
    function codexCardHandler() { vscode.postMessage({ command: 'openCodex' }); }
    codexCard.addEventListener('click', codexCardHandler);
    _ftr10SidebarListeners.push(() => codexCard.removeEventListener('click', codexCardHandler));

    function sidebarMsgHandler(e) {
      const msg = e.data;
      if (msg.command === 'syncActive') {
        if (msg.accentColor) {
          document.documentElement.style.setProperty('--ftr10-accent-1', msg.accentColor);
        }
        document.querySelectorAll('.theme-card').forEach((c) => {
          const presetId = c.getAttribute('data-preset-id');
          const isActive = presetId && presetId === msg.activePreset;
          c.classList.toggle('active', !!isActive);
          const badge = c.querySelector('.card-active-badge');
          if (isActive && !badge) {
            const b = document.createElement('div');
            b.className = 'card-active-badge';
            b.textContent = 'Active';
            c.appendChild(b);
          } else if (!isActive && badge) {
            badge.remove();
          }
        });
      }
      if (msg.command === 'syncSessions') {
        document.getElementById('sessionList').innerHTML = msg.cardsHtml;
        if (msg.accentColor) {
          document.documentElement.style.setProperty('--ftr10-accent-1', msg.accentColor);
        }
      }
      if (msg.command === 'syncBgModes' && msg.bgModeMap) {
        document.querySelectorAll('.bg-mode-btn').forEach((btn) => {
          const id = btn.getAttribute('data-preset-id');
          const mode = msg.bgModeMap[id] || 'effects';
          btn.setAttribute('data-mode', mode);
          btn.className = 'bg-mode-btn ' + mode;
          btn.textContent = mode === 'effects' ? '✦ Effects' : '▣ Solid';
          btn.title = mode === 'effects'
            ? 'Using Thpace + transparent bg — click to switch to solid'
            : 'Using preset solid bg — click to switch to effects';
        });
      }
      if (msg.command === 'CodexColors' && msg.colors) {
        const row = document.getElementById('dsCardSwatches');
        if (row) {
          const swatches = row.querySelectorAll('.swatch');
          msg.colors.slice(0, 3).forEach((c, i) => {
            if (swatches[i]) swatches[i].style.background = c;
          });
        }
      }
      if (msg.command === 'relayVars' && msg.cssVars) {
        try { new BroadcastChannel('theme-sync').postMessage({ cssVars: msg.cssVars }); } catch(_) {}
      }
    }
    window.addEventListener('message', sidebarMsgHandler);
    _ftr10SidebarListeners.push(() => window.removeEventListener('message', sidebarMsgHandler));

    window.addEventListener('beforeunload', () => {
      _ftr10SidebarListeners.forEach(fn => { try { fn(); } catch(_){} });
    });
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// Codex panel
// ═══════════════════════════════════════════════════════════════════

function applyArchitectSession(sessionId: string): void {
  const session = themeConfig.architectSessions[sessionId];
  if (!session) {return;}
  const preset = deriveCodexPreset(session);
  const existingIdx = THEME_PRESETS.findIndex(p => p.id === preset.id);
  if (existingIdx >= 0) { THEME_PRESETS[existingIdx] = preset; }
  else { THEME_PRESETS.push(preset); }
  applyPreset(preset.id);
  sidebarProvider?.syncSessions();
  // If Architect panel is open, switch it to this session
  if (CodexPanel) {
    CodexPanel.webview.postMessage({ command: 'loadSession', session: sanitizeSession(session), derivedValues: sanitizeForWebview(themeConfig.values) });
  }
}

// SAFETY: webview postMessage is capped (~1MB) by VS Code. A stored data: URI
// (e.g. a session varOverride embedding a background image) would make the
// message silently DROPPED -> panel shows "Load config to edit" with no data.
// Strip oversized/data-URI blobs before posting to any webview.
function sanitizeForWebview(vals: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(vals || {})) {
    if (typeof v === 'string' && (v.startsWith('data:') || v.length > 2000)) {
      out[k] = v.startsWith('url(') ? v : 'none';
    } else {
      out[k] = v;
    }
  }
  return out;
}
function sanitizeConfigForWebview(cfg: ThemeConfig): ThemeConfig {
  const safe: ThemeConfig = JSON.parse(JSON.stringify(cfg));
  if (safe.values) {safe.values = sanitizeForWebview(safe.values);}
  if (safe.architectSessions) {
    for (const sid of Object.keys(safe.architectSessions)) {
      const sess: any = safe.architectSessions[sid];
      if (sess && sess.varOverrides) {sess.varOverrides = sanitizeForWebview(sess.varOverrides);}
      if (sess && typeof sess.bgImage === 'string' && (sess.bgImage.startsWith('data:') || sess.bgImage.length > 2000)) {sess.bgImage = 'none';}
    }
  }
  return safe;
}

function sanitizeSession(s: any): any {
  if (!s) {return s;}
  const copy = JSON.parse(JSON.stringify(s));
  if (copy.varOverrides) {copy.varOverrides = sanitizeForWebview(copy.varOverrides);}
  if (typeof copy.bgImage === 'string' && (copy.bgImage.startsWith('data:') || copy.bgImage.length > 2000)) {copy.bgImage = 'none';}
  return copy;
}

function createCodexPanel(context: vscode.ExtensionContext, sessionId?: string): void {
  if (CodexPanel) {
    CodexPanel.reveal(vscode.ViewColumn.One);
    if (sessionId) {
      const session = themeConfig.architectSessions[sessionId];
      if (session) {
        const derivedValues = themeConfig.activePreset === `arch-${sessionId}` ? themeConfig.values : undefined;
        CodexPanel.webview.postMessage({ command: 'loadSession', session: sanitizeSession(session), derivedValues: sanitizeForWebview(derivedValues || {}) });
      }
    }
    return;
  }
  CodexPanel = vscode.window.createWebviewPanel(
    'CodexPanel', 'FTR10 Architect', vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(process.env.HOME || require('os').homedir(), '.ftr10'))] }
  );
  CodexPanel.webview.html = getCodexHtml();
  const _codexRef = CodexPanel;
  CodexPanel.onDidDispose(() => { unregisterLivePanel(_codexRef); CodexPanel = undefined; }, null, context.subscriptions);
  registerLivePanel(CodexPanel);

  if (sessionId) {
    const session = themeConfig.architectSessions[sessionId];
    if (session) {
      const derivedValues = themeConfig.activePreset === `arch-${sessionId}` ? themeConfig.values : undefined;
      setTimeout(() => CodexPanel?.webview.postMessage({ command: 'loadSession', session: sanitizeSession(session), derivedValues: sanitizeForWebview(derivedValues || {}) }), 300);
    }
  }

  CodexPanel.webview.onDidReceiveMessage((msg: any) => {
    if (msg.command === 'CodexUpdate' && Array.isArray(msg.colors)) {
      sidebarProvider?.pushCodexColors(msg.colors);
      // LIVE palette update — instant without Apply, only palette-derived vars
      // User spec: changing accent-1 via color wheel should immediately update
      // accent-1 and its derived variants (accent-1-80 etc via CSS color-mix auto,
      // plus glass/border/shadow derived from accent-1). Backgrounds/fonts etc
      // must NOT auto-update — only palette.
      try {
        const cols = msg.colors as string[];
        if (cols.length >= 6) {
          const [c1,c2,c3,c4,c5,c6] = cols;
          const tempSession = {
            id: 'live', name: 'live', baseHue: 0, harmony: 'analogous',
            swatchOverrides: {}, savedColors: cols.slice(0,6),
            bgEffect: themeConfig.values['--ftr10-bg-effect'] || 'none',
            thpaceEnabled: themeConfig.values['--ftr10-thpace-enabled'] || 'true',
            createdAt: Date.now(), updatedAt: Date.now()
          } as ArchitectSession;
          const preset = deriveCodexPreset(tempSession);
          const r = parseInt(c1.slice(1,3),16), g = parseInt(c1.slice(3,5),16), b = parseInt(c1.slice(5,7),16);
          const accDerived = accentDerived(r,g,b);
          // Keys that are palette-derived and should live-update
          const liveOverrides: Record<string,string> = {
            '--ftr10-accent-1': c1 + 'd4',
            '--ftr10-accent-2': c2,
            '--ftr10-accent-3': c3,
            '--ftr10-accent-4': c4,
            '--ftr10-surface-1': c5 + '30',
            '--ftr10-surface-2': c6 + '18',
            '--ftr10-cursor': c4,
            '--ftr10-tab-border-color': c1,
            ...preset.overrides,
            ...accDerived
          };
          // Denylist — never live-update these from palette drag
          const deny = new Set([
            '--ftr10-bg-effect','--ftr10-thpace-enabled','--ftr10-bg','--ftr10-bg-editor',
            '--ftr10-bg-image','--ftr10-bg-image-panels','--ftr10-bg-sidebar','--ftr10-bg-panel-bottom',
            '--ftr10-body-font','--ftr10-heading-font','--ftr10-code-font',
            '--ftr10-font-activitybar','--ftr10-font-sidebar','--ftr10-font-panel-bottom',
            '--ftr10-font-panel-top','--ftr10-font-auxiliarybar'
          ]);
          const changedKeys: string[] = [];
          for (const [k,v] of Object.entries(liveOverrides)) {
            if (deny.has(k)) {continue;}
            // Only allow palette + tokens + accent-derived glass/border/shadows + bg-ambient
            const isPalette = k.startsWith('--ftr10-accent-') || k.startsWith('--ftr10-surface-') || k.startsWith('--ftr10-token-') || k.startsWith('--ftr10-cursor') || k.startsWith('--ftr10-tab-') || k === '--ftr10-bg-ambient' || k.startsWith('--ftr10-border') || k.startsWith('--ftr10-glass-') || k.startsWith('--ftr10-shadow-') || k.startsWith('--ftr10-inset-') || k.startsWith('--ftr10-activitybar-') || k.startsWith('--ftr10-editor-') || k.startsWith('--ftr10-accent-shadow-');
            if (!isPalette) {continue;}
            if (themeConfig.values[k] !== v) {
              themeConfig.values[k] = v;
              changedKeys.push(k);
            }
          }
          if (changedKeys.length) {
            persistThemeConfig({ fast: true, changedKeys });
          }
        }
      } catch(e) { console.error('CodexUpdate live failed', e); }
    }

    if (msg.command === 'getConfig') {
      let bgImages: { name: string; dataUri: string }[] = [];
      try {
        const bgDir = path.join((process.env.HOME || require('os').homedir()), '.ftr10', 'backgrounds');
        if (fs.existsSync(bgDir)) {
          bgImages = fs.readdirSync(bgDir)
            .filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f))
            .sort((a, b) => a.localeCompare(b))
            .map(f => ({ name: f, dataUri: '' })); // names only, no base64 to keep message small
        }
      } catch {}
      let canonicalVals: Record<string,string> = {};
      try { canonicalVals = parseColorsCssFile(); } catch {}
      const mergedVals = { ...themeConfig.values, ...canonicalVals };
      if (Object.keys(canonicalVals).length) {themeConfig.values = mergedVals;}
      // Strip oversized/data-URI blobs so the message stays under VS Code's ~1MB cap
      const safeConfig = sanitizeConfigForWebview(themeConfig);
      CodexPanel?.webview.postMessage({ command: 'architectConfig', config: safeConfig, simpleGroups: SIMPLE_GROUPS, activePreset: themeConfig.activePreset, values: sanitizeForWebview(mergedVals), bgImages });
    }

    if (msg.command === 'liveUpdate' && msg.values) {
      const changedKeys = Object.keys(msg.values);
      // Canonical: update colors.css, then sync
      try {
        updateColorsCssWithValues(msg.values as Record<string,string>);
      } catch(e){ console.error('liveUpdate canonical failed', e); 
        // fallback
        themeConfig.values = { ...themeConfig.values, ...msg.values };
        persistThemeConfig({ fast: true, changedKeys });
      }
    }

    if (msg.command === 'saveSession' && Array.isArray(msg.colors) && msg.colors.length >= 6) {
      // If sessionId is provided, overwrite that card; otherwise create a new one
      const id: string = msg.sessionId || Date.now().toString(36);
      const existing = themeConfig.architectSessions[id];
      const session: ArchitectSession = {
        id,
        name: (msg.name || 'Untitled').slice(0, 40),
        baseHue: typeof msg.baseHue === 'number' ? msg.baseHue : 0,
        harmony: msg.harmony || 'analogous',
        swatchOverrides: msg.swatchOverrides || {},
        savedColors: msg.colors.slice(0, 6),
        bgEffect: msg.bgEffect || existing?.bgEffect || 'nebula',
        thpaceEnabled: msg.thpaceEnabled || existing?.thpaceEnabled || 'true',
        // Persist extra Vars-panel edits as a diff vs. the palette-derived set.
        // msg.vars is the full live varsState.values; the diff is what changed.
        varOverrides: computeSessionVarDiff(
          {
            id, name: (msg.name || 'Untitled').slice(0, 40),
            baseHue: typeof msg.baseHue === 'number' ? msg.baseHue : 0,
            harmony: msg.harmony || 'analogous',
            swatchOverrides: msg.swatchOverrides || {},
            savedColors: msg.colors.slice(0, 6),
            bgEffect: msg.bgEffect || existing?.bgEffect || 'nebula',
            thpaceEnabled: msg.thpaceEnabled || existing?.thpaceEnabled || 'true',
            createdAt: existing?.createdAt ?? Date.now(),
            updatedAt: Date.now()
          },
          msg.vars || themeConfig.values
        ),
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        isBase: existing?.isBase ?? false,
        basePresetId: existing?.basePresetId
      };
      themeConfig.architectSessions[id] = session;
      persistThemeConfig();
      sidebarProvider?.syncSessions();
      CodexPanel?.webview.postMessage({ command: 'sessionSaved', sessionId: id, name: session.name });
      vscode.window.showInformationMessage(`Session "${session.name}" saved.`);
    }

    if (msg.command === 'applySession' && Array.isArray(msg.colors) && msg.colors.length >= 6) {
      const id: string = msg.sessionId || Date.now().toString(36);
      const existing = themeConfig.architectSessions[id];
      const varDiff = computeSessionVarDiff(
        {
          id, name: (msg.name || 'Untitled').slice(0, 40),
          baseHue: typeof msg.baseHue === 'number' ? msg.baseHue : 0,
          harmony: msg.harmony || 'analogous',
          swatchOverrides: msg.swatchOverrides || {},
          savedColors: msg.colors.slice(0, 6),
          bgEffect: msg.bgEffect || existing?.bgEffect || 'nebula',
          thpaceEnabled: msg.thpaceEnabled || existing?.thpaceEnabled || 'true',
          createdAt: existing?.createdAt ?? Date.now(),
          updatedAt: Date.now()
        },
        msg.vars || themeConfig.values
      );
      const session: ArchitectSession = {
        id,
        name: (msg.name || 'Untitled').slice(0, 40),
        baseHue: typeof msg.baseHue === 'number' ? msg.baseHue : 0,
        harmony: msg.harmony || 'analogous',
        swatchOverrides: msg.swatchOverrides || {},
        savedColors: msg.colors.slice(0, 6),
        bgEffect: msg.bgEffect || existing?.bgEffect || 'nebula',
        thpaceEnabled: msg.thpaceEnabled || existing?.thpaceEnabled || 'true',
        varOverrides: varDiff,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        isBase: existing?.isBase ?? false,
        basePresetId: existing?.basePresetId
      };
      themeConfig.architectSessions[id] = session;
      const preset = deriveCodexPreset(session);
      const existingIdx = THEME_PRESETS.findIndex(p => p.id === preset.id);
      if (existingIdx >= 0) { THEME_PRESETS[existingIdx] = preset; }
      else { THEME_PRESETS.push(preset); }
      applyPreset(preset.id);
      // applyPreset() rebuilds themeConfig.values from the derived preset, which
      // already includes varOverrides (see deriveCodexPreset). Re-assert the diff
      // onto the live config so the user's Vars-panel edits survive the apply and
      // get persisted as presetCustomizations for the active arch preset.
      themeConfig.values = { ...themeConfig.values, ...varDiff };
      persistThemeConfig();
      sidebarProvider?.syncSessions();
      CodexPanel?.webview.postMessage({ command: 'sessionSaved', sessionId: id, name: session.name });
      vscode.window.showInformationMessage(`"${session.name}" applied.`);
    }
  }, undefined, context.subscriptions);
}

function getCodexHtml(): string {
  return `<!DOCTYPE html>
<!-- Codex CONCEPT C — CyberPalette v3 -->
<!-- Inspired by: cyberpunk hue torus, perspective side-panels, dynamic ambient bg -->
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Codex — CyberPalette</title>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
<style>
  :root {
    --ui-accent: #00d4ff;
    --ui-accent-rgb: 0,212,255;
  }
  * { margin:0; padding:0; box-sizing:border-box; }

  body, html {
    height: 100%;
    font-family: 'Share Tech Mono', monospace;
    background: transparent;
    color: #b0d0ff;
    overflow-x: hidden;
  }
  body { scrollbar-width: thin; scrollbar-color: rgba(var(--ui-accent-rgb),0.13) transparent; }
  body::-webkit-scrollbar { width: 5px; }
  body::-webkit-scrollbar-thumb { background: rgba(var(--ui-accent-rgb),0.13); border-radius: 3px; }

  /* ── ambient background ─────────────────────────────────────── */
  #ambientBg {
    position: fixed; inset: 0; z-index: 0;
    transition: background 1.2s ease;
    /* starts dark; updates dynamically */
  }
  #ambientBg::after {
    content: '';
    position: absolute; inset: 0;
    background: transparent;
  }

  /* ── particle canvas ─────────────────────────────────────────── */
  #particles {
    /* Last child of body + high z-index: bypasses backdrop-filter/transform
       compositor layer issues from .ep-wrap inside .stage */
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    z-index: 9999;
    pointer-events: none;
    will-change: transform; /* own GPU compositing layer */
  }

  /* ── layout ──────────────────────────────────────────────────── */
  .stage {
    position: relative; z-index: 2;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 22px 12px 40px;
  }

  /* ── title ───────────────────────────────────────────────────── */
  .cyber-title {
    font-family: 'Orbitron', sans-serif;
    font-size: clamp(1.1rem, 3.5vw, 1.7rem);
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: var(--ui-accent);
    text-shadow:
      0 0 8px rgba(var(--ui-accent-rgb),0.8),
      0 0 22px rgba(var(--ui-accent-rgb),0.4),
      0 0 50px rgba(var(--ui-accent-rgb),0.2);
    margin-bottom: 4px;
  }
  .cyber-sub {
    font-size: 0.65rem;
    letter-spacing: 6px;
    color: rgba(var(--ui-accent-rgb),0.35);
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  /* ── three-panel row ─────────────────────────────────────────── */
  .panel-row {
    display: flex;
    align-items: start;
    justify-content: center;
    gap: 0;
    width: 100%;
    max-width: 860px;
    margin-bottom: 18px;
    min-height: 480px;
  }

  /* ── side swatch panels ──────────────────────────────────────── */
  .swatch-panel {
    flex: 0 0 auto;
    width: clamp(118px, 16vw, 168px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    position: relative;
    z-index: 1;
    margin-top: 0;
  }

  /* ── electric border wrapper ─────────────────────────────────── */
  .ep-wrap {
    position: relative;
    flex: 0 0 auto;
    padding: 14px 12px;
    margin-top: -12px;
    border-radius: 18px;
    background: rgba(0,8,20,0.55);
    backdrop-filter: blur(4px);
    box-shadow: inset 0 0 14px rgba(var(--ui-accent-rgb),0.04);
  }
  .ep-wrap.left  { transform: perspective(420px) rotateY(22deg) rotateZ(-1deg) translateX(30px); }
  .ep-wrap.right { transform: perspective(420px) rotateY(-22deg) rotateZ(1deg) translateX(-30px); }

  .ep-canvas {
    position: absolute;
    top: -20px; left: -20px;
    width: calc(100% + 40px); height: calc(100% + 40px);
    border-radius: 18px;
    pointer-events: none;
    z-index: 10;
  }
  .ep-glow-1 {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    border: 1.5px solid rgba(var(--ui-accent-rgb),0.6);
    filter: blur(1px);
    pointer-events: none;
  }
  .ep-glow-2 {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    border: 1.5px solid var(--ui-accent);
    filter: blur(4px);
    pointer-events: none;
  }
  .ep-bg-glow {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    filter: blur(28px);
    transform: scale(1.12);
    opacity: 0.22;
    z-index: 0;
    pointer-events: none;
    background: linear-gradient(-30deg, var(--ui-accent), transparent, var(--ui-accent));
  }

  .swatch-row {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .ps {
    width: clamp(44px, 5.2vw, 68px);
    height: clamp(44px, 5.2vw, 68px);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow:
      0 2px 8px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.15);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.3s;
    position: relative;
    overflow: hidden;
  }
  .ps::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 50%);
    border-radius: inherit;
    pointer-events: none;
  }
  .ps:hover {
    transform: scale(1.06) translateY(-2px);
    box-shadow:
      0 6px 18px rgba(0,0,0,0.5),
      0 0 12px var(--glow, rgba(0,212,255,0.3)),
      inset 0 1px 0 rgba(255,255,255,0.2);
  }

  /* ── center column ───────────────────────────────────────────── */
  .center-col {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    min-width: 0;
    padding-top: 0;
  }

  /* ── hue ring container ──────────────────────────────────────── */
  .wheel-wrap {
    position: relative;
    width: 220px; height: 220px;
  }

  .wheel-glow {
    position: absolute;
    inset: -18px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(var(--ui-accent-rgb),0.28) 0%, rgba(var(--ui-accent-rgb),0.10) 45%, transparent 70%);
    filter: blur(14px);
    pointer-events: none;
    animation: wheelPulse 2.4s ease-in-out infinite;
    z-index: 0;
  }
  @keyframes wheelPulse {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50%       { opacity: 1;   transform: scale(1.12); }
  }

  #hueWheel {
    display: block;
    position: relative;
    z-index: 1;
    cursor: crosshair;
  }

  /* inner void glow */
  .wheel-void {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 82px; height: 82px;
    border-radius: 50%;
    background: radial-gradient(circle, #020408 60%, transparent 100%);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  .wheel-hue-num {
    font-family: 'Orbitron', sans-serif;
    font-size: 22px;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: 0;
    color: hsl(200, 90%, 75%);
    text-shadow: 0 0 10px hsl(200, 100%, 65%), 0 0 22px hsl(200, 100%, 55%);
    transition: color 0.1s, text-shadow 0.1s;
  }


  /* ── harmony buttons ─────────────────────────────────────────── */
  .harmony-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    max-width: 280px;
  }

  .hbtn {
    padding: 5px 12px;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 1px;
    text-transform: uppercase;
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.85);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .hbtn:hover {
    background: rgba(var(--ui-accent-rgb),0.12);
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
    box-shadow: 0 0 8px rgba(var(--ui-accent-rgb),0.2);
  }
  .hbtn.active {
    background: rgba(var(--ui-accent-rgb),0.15);
    border-color: var(--ui-accent);
    color: var(--ui-accent);
    box-shadow: 0 0 10px rgba(var(--ui-accent-rgb),0.35), inset 0 0 6px rgba(var(--ui-accent-rgb),0.1);
  }

  /* ── name row ────────────────────────────────────────────────── */
  .name-row {
    display: flex;
    margin-bottom: 6px;
  }
  .session-name-input {
    width: 100%;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    letter-spacing: 1px;
    padding: 5px 10px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.22);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.85);
    outline: none;
    transition: border-color 0.15s;
  }
  .session-name-input::placeholder { color: rgba(var(--ui-accent-rgb),0.35); }
  .session-name-input:focus { border-color: rgba(var(--ui-accent-rgb),0.6); }

  /* ── action row ──────────────────────────────────────────────── */
  .action-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .btn-rand, .btn-apply {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    overflow: hidden;
  }
  @keyframes btnPop {
    0%   { transform: scale(1); }
    30%  { transform: scale(0.93); }
    65%  { transform: scale(1.07); }
    100% { transform: scale(1); }
  }
  @keyframes btnRipple {
    0%   { transform: scale(0); opacity: 0.7; }
    100% { transform: scale(2.8); opacity: 0; }
  }
  .btn-ripple {
    position: absolute;
    border-radius: 50%;
    width: 120px; height: 120px;
    margin-left: -60px; margin-top: -60px;
    background: rgba(var(--ui-accent-rgb), 0.45);
    pointer-events: none;
    animation: btnRipple 0.55s ease-out forwards;
  }
  .btn-rand {
    border: 1px solid rgba(255,255,255,0.12);
    background: rgba(0,8,20,0.62);
    color: rgba(var(--ui-accent-rgb),0.75);
    font-weight: 500;
  }
  .btn-rand:hover {
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
    background: rgba(0,8,20,0.75);
  }
  .btn-apply {
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(0,8,20,0.62);
    color: var(--ui-accent);
    font-weight: 500;
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.2);
  }
  .btn-apply:hover {
    background: rgba(var(--ui-accent-rgb),0.22);
    box-shadow: 0 0 20px rgba(var(--ui-accent-rgb),0.4);
  }
  .btn-apply:active {
    transform: scale(0.97);
  }
  .btn-save {
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(0,8,20,0.62);
    color: rgba(180,220,255,0.75);
    font-weight: 500;
  }
  .btn-save:hover {
    border-color: rgba(var(--ui-accent-rgb),0.45);
    color: rgba(var(--ui-accent-rgb),0.9);
    background: rgba(0,8,20,0.8);
  }

  /* ── color override modal ─────────────────────────────────────── */
  .override-modal-bg {
    display: none;
    position: fixed; inset: 0; z-index: 100;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    align-items: center;
    justify-content: center;
  }
  .override-modal-bg.open { display: flex; }
  .override-modal {
    background: rgba(2,6,18,0.96);
    border: 1px solid rgba(var(--ui-accent-rgb),0.3);
    border-radius: 14px;
    padding: 18px;
    box-shadow: 0 0 50px rgba(var(--ui-accent-rgb),0.18), inset 0 0 20px rgba(var(--ui-accent-rgb),0.04);
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 220px;
  }
  .override-modal-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
  }
  .override-picker-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .sl-canvas {
    border-radius: 6px;
    cursor: crosshair;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .hue-strip-canvas {
    border-radius: 4px;
    cursor: crosshair;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .override-preview-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .override-preview-swatch {
    width: 38px; height: 38px;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.15);
    flex-shrink: 0;
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.2);
  }
  .override-preview-hex {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.78rem;
    letter-spacing: 1.5px;
    color: rgba(255,255,255,0.92);
  }
  .override-btn-row {
    display: flex;
    gap: 7px;
  }
  .override-btn {
    flex: 1;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.68rem;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
    background: rgba(0,8,20,0.62);
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(var(--ui-accent-rgb),0.8);
  }
  .override-btn:hover {
    background: rgba(var(--ui-accent-rgb),0.12);
    border-color: rgba(var(--ui-accent-rgb),0.5);
    color: var(--ui-accent);
  }
  .override-btn.confirm {
    border-color: rgba(var(--ui-accent-rgb),0.4);
    color: var(--ui-accent);
  }
  .override-btn.confirm:hover {
    background: rgba(var(--ui-accent-rgb),0.2);
    box-shadow: 0 0 12px rgba(var(--ui-accent-rgb),0.3);
  }
  .ps.has-override {
    outline: 2px solid rgba(var(--ui-accent-rgb),0.45);
    outline-offset: 2px;
  }
  .ps-override-x {
    display: none;
    position: absolute;
    top: 3px; right: 3px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: rgba(10,12,24,0.82);
    border: 1px solid rgba(255,255,255,0.3);
    color: rgba(255,255,255,0.88);
    font-size: 9px;
    line-height: 12px;
    text-align: center;
    cursor: pointer;
    z-index: 4;
    pointer-events: all;
    font-family: sans-serif;
    transition: background 0.12s, border-color 0.12s;
  }
  .ps.has-override .ps-override-x { display: block; }
  .ps-override-x:hover {
    background: rgba(220,60,60,0.85);
    border-color: rgba(255,120,120,0.7);
  }

  /* ── hex list ────────────────────────────────────────────────── */
  #hexList {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    justify-content: center;
    max-width: 280px;
  }
  .hex-chip {
    font-size: 0.62rem;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.04);
    cursor: pointer;
    transition: all 0.12s;
    color: #c0d0ff;
    font-family: 'Share Tech Mono', monospace;
  }
  .hex-chip:hover {
    border-color: rgba(255,255,255,0.3);
    background: rgba(255,255,255,0.08);
    color: #fff;
  }

  /* ── right-side role legend ─────────────────────────────────── */
  .legend-wrap {
    position: absolute;
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .legend-panel {
    width: clamp(176px, 18vw, 214px);
    max-height: min(62vh, 440px);
    overflow: auto;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
  }
  .legend-panel.mobile {
    display: none;
    position: static;
    left: auto;
    top: auto;
    transform: none;
    width: min(94vw, 360px);
    max-height: 34vh;
    margin: 8px auto 0;
  }
  .legend-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
    margin-bottom: 6px;
  }
  .legend-row {
    display: grid;
    grid-template-columns: 12px 1fr auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    padding: 5px 6px;
    margin-bottom: 5px;
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.28);
    box-shadow: 0 0 8px var(--lg, rgba(0,212,255,0.4));
  }
  .legend-name {
    font-size: 0.68rem;
    letter-spacing: 1px;
    color: rgba(220,235,255,0.95);
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-meta {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .legend-color-name {
    font-size: 0.6rem;
    letter-spacing: 0.7px;
    color: rgba(185,210,240,0.82);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .legend-hex {
    font-size: 0.64rem;
    letter-spacing: 0.8px;
    color: rgba(255,255,255,0.92);
    cursor: pointer;
    font-family: 'Share Tech Mono', monospace;
  }
  .legend-hex:hover {
    color: #fff;
    text-decoration: underline;
  }

  /* ── left cluster ──────────────────────────────────────────────── */
  .left-cluster {
    position: relative;
    display: flex;
    align-items: flex-start;
    flex: 0 0 auto;
  }
  .left-legend-wrap {
    position: absolute;
    right: calc(100% + 8px);
    top: 0;
    left: auto;
    transform: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: clamp(172px, 17vw, 210px);
    margin-top: 0;
    z-index: 20;
  }

  .right-legend-wrap {
    position: absolute;
    left: calc(100% + 8px);
    top: 0;
    right: auto;
    transform: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: clamp(172px, 17vw, 210px);
    margin-top: 0;
    z-index: 20;
  }

  .right-cluster {
    position: relative;
    display: flex;
    align-items: flex-start;
    flex: 0 0 auto;
  }

  /* shared quick-panel (Backgrounds / Fonts / Opacity) */
  .quick-panel {
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
  }
  .qp-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 5px;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 5px;
    background: rgba(255,255,255,0.025);
    padding: 3px 6px;
    margin-top: 3px;
  }
  .qp-label {
    font-size: 0.56rem;
    letter-spacing: 0.9px;
    color: rgba(195,220,255,0.82);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .qp-select {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.56rem;
    padding: 2px 3px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.2);
    background: rgba(0,6,18,0.85);
    color: rgba(200,220,255,0.88);
    outline: none;
    max-width: 88px;
  }
  .qp-slider-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .qp-slider {
    width: 48px;
    accent-color: var(--ui-accent);
    height: 4px;
  }
  .qp-val {
    font-size: 0.56rem;
    color: rgba(var(--ui-accent-rgb),0.9);
    font-family: 'Share Tech Mono', monospace;
    min-width: 22px;
    text-align: right;
  }

  /* ── HUD corner ──────────────────────────────────────────────── */
  .hud {
    z-index: 10;
    font-size: 0.56rem;
    letter-spacing: 0;
    text-transform: uppercase;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,8,20,0.62);
    border-radius: 10px;
    padding: 8px;
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.08), inset 0 0 10px rgba(var(--ui-accent-rgb),0.05);
    backdrop-filter: blur(3px);
    pointer-events: none;
  }
  .hud-title {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.74rem;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.9);
    text-align: center;
    margin-bottom: 6px;
  }
  .hud-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
    padding: 5px 6px;
    margin-bottom: 5px;
  }
  .hud-row:last-child { margin-bottom: 0; }
  .hud-label {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(195,220,255,0.86);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .hud-value {
    font-size: 0.56rem;
    letter-spacing: 0.8px;
    color: rgba(var(--ui-accent-rgb),0.9);
    font-family: 'Share Tech Mono', monospace;
    white-space: nowrap;
  }

  /* ── bg toggles ──────────────────────────────────────────────── */
  .bg-toggles {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 8px;
  }
  .bg-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 6px;
    background: rgba(255,255,255,0.03);
  }
  .bg-toggle-label {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(195,220,255,0.86);
    text-transform: uppercase;
    white-space: nowrap;
  }
  .bg-toggle-pill {
    position: relative;
    width: 32px;
    height: 16px;
    flex-shrink: 0;
  }
  .bg-toggle-pill input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .bg-toggle-track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: rgba(255,255,255,0.12);
    cursor: pointer;
    transition: background 0.22s;
  }
  .bg-toggle-track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: rgba(180,205,255,0.55);
    transition: transform 0.22s, background 0.22s;
  }
  .bg-toggle-pill input:checked + .bg-toggle-track {
    background: rgba(var(--ui-accent-rgb),0.45);
  }
  .bg-toggle-pill input:checked + .bg-toggle-track::after {
    transform: translateX(16px);
    background: rgba(var(--ui-accent-rgb),1);
  }

  /* ── bg image gallery ─────────────────────────────────── */
  .bg-img-gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
    gap: 5px;
    margin-top: 8px;
    max-height: 168px;
    overflow-y: auto;
    padding: 5px;
    border-radius: 8px;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .bg-img-thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    padding: 0;
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    background: #000;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
  }
  .bg-img-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }
  .bg-img-thumb:hover { transform: translateY(-1px); border-color: rgba(var(--ui-accent-rgb),0.6); }
  .bg-img-thumb.selected {
    border-color: rgba(var(--ui-accent-rgb),1);
    box-shadow: 0 0 0 1px rgba(var(--ui-accent-rgb),1), 0 0 12px rgba(var(--ui-accent-rgb),0.55);
  }

  /* ── responsive collapse ─────────────────────────────────────── */
  @media (max-width: 420px) {
    .swatch-panel { display: none; }
    .panel-row { justify-content: center; }
    .legend-wrap { display: none; }
    .legend-panel.mobile {
      display: block;
      width: min(96vw, 340px);
      max-height: 30vh;
    }
  }

  @media (max-width: 1400px) {
    .left-legend-wrap { right: calc(100% + 6px); width: clamp(158px, 15vw, 196px); }
    .right-legend-wrap { left: calc(100% + 6px); width: clamp(158px, 15vw, 196px); }
  }
  @media (max-width: 1200px) {
    .panel-row {
      flex-wrap: wrap;
      justify-content: center;
      min-height: 0;
    }
    .center-col {
      width: min(100%, 360px);
    }
    .left-legend-wrap, .right-legend-wrap { display: none; }
    .legend-panel.mobile { display: block; }
    .tables-below {
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 12px;
      margin: 12px 0 0 0;
      width: 100%;
      justify-content: center;
    }
    .tables-below > * {
      min-width: 160px;
      max-width: 240px;
      flex: 1 1 160px;
    }
  }

  @media (max-width: 1280px) {
    .legend-wrap {
      left: calc(100% + 6px);
    }
    .legend-panel {
      width: clamp(168px, 20vw, 196px);
    }
  }

  @media (max-width: 1080px) {
    .legend-wrap { display: none; }
    .legend-panel.mobile { display: block; }
  }

  /* ── vars panel ───────────────────────────────────────────────── */
  .vars-panel {
    position: relative; z-index: 2;
    width: min(96vw, 860px);
    margin: 12px auto 60px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    border-radius: 14px;
    background: rgba(0,8,20,0.62);
    backdrop-filter: blur(4px);
    box-shadow: 0 0 18px rgba(var(--ui-accent-rgb),0.07), inset 0 0 10px rgba(var(--ui-accent-rgb),0.04);
  }
  .vars-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 10px;
    border-bottom: 1px solid rgba(var(--ui-accent-rgb),0.12);
  }
  .vars-panel-title {
    font-family: 'Orbitron', sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.85);
  }
  .vars-toggle-row { display: flex; align-items: center; gap: 8px; }
  .vars-toggle-label {
    font-size: 0.65rem;
    letter-spacing: 1.5px;
    color: rgba(var(--ui-accent-rgb),0.5);
    text-transform: uppercase;
  }
  .vars-toggle-btn {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.7rem;
    padding: 3px 10px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.25);
    background: rgba(0,8,20,0.7);
    color: rgba(var(--ui-accent-rgb),0.7);
    cursor: pointer;
    letter-spacing: 1px;
    transition: all 0.15s;
  }
  .vars-toggle-btn:hover { border-color: rgba(var(--ui-accent-rgb),0.55); color: var(--ui-accent); }
  .vars-content { padding: 12px 14px 14px; }
  .v-empty {
    font-size: 0.7rem;
    letter-spacing: 0.8px;
    color: rgba(var(--ui-accent-rgb),0.35);
    text-align: center;
    padding: 18px 0;
  }
  .v-group {
    margin-bottom: 8px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.1);
    border-radius: 8px;
    overflow: hidden;
    background: rgba(0,4,14,0.4);
  }
  .v-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 12px;
    font-size: 0.68rem;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: rgba(var(--ui-accent-rgb),0.8);
    cursor: pointer;
    user-select: none;
    background: rgba(var(--ui-accent-rgb),0.06);
    list-style: none;
  }
  .v-group-header::-webkit-details-marker { display: none; }
  .v-count {
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: rgba(var(--ui-accent-rgb),0.4);
    background: rgba(var(--ui-accent-rgb),0.08);
    border: 1px solid rgba(var(--ui-accent-rgb),0.12);
    border-radius: 3px;
    padding: 1px 5px;
  }
  .v-group-fields { padding: 8px 10px; display: flex; flex-direction: column; gap: 5px; }
  .v-field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .v-field-row:last-child { border-bottom: none; }
  .v-field-label {
    font-size: 0.65rem;
    letter-spacing: 0.8px;
    color: rgba(185,210,255,0.7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: 'Share Tech Mono', monospace;
  }
  .v-field-input-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .v-field-input-wrap input[type="color"] {
    width: 28px; height: 24px;
    padding: 1px 2px;
    border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.15);
    background: transparent;
    cursor: pointer;
    flex-shrink: 0;
  }
  .v-field-input-wrap input[type="text"] {
    flex: 1;
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.8px;
    padding: 3px 7px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.18);
    background: rgba(0,6,18,0.7);
    color: rgba(200,220,255,0.9);
    outline: none;
    min-width: 0;
  }
  .v-field-input-wrap input[type="text"]:focus { border-color: rgba(var(--ui-accent-rgb),0.5); }
  .v-alpha-wrap {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  .v-alpha-wrap input[type="range"] {
    width: 52px;
    accent-color: var(--sw, var(--ui-accent));
    height: 4px;
  }
  .v-alpha-label {
    font-size: 0.58rem;
    color: rgba(var(--ui-accent-rgb),0.5);
    white-space: nowrap;
    font-family: 'Share Tech Mono', monospace;
  }
  .v-select-wrap select {
    font-family: 'Share Tech Mono', monospace;
    font-size: 0.65rem;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid rgba(var(--ui-accent-rgb),0.2);
    background: rgba(0,6,18,0.8);
    color: rgba(200,220,255,0.9);
    outline: none;
    width: 100%;
  }
</style>
</head>
<body>

<div id="ambientBg"></div>
<canvas id="particles"></canvas>

<div class="stage">
  <div class="cyber-title">FTR10 Codex</div>
  <div class="cyber-sub">Color Architect</div>

  <div class="panel-row">
    <!-- left cluster: swatches + floating left-side tables -->
    <div class="left-cluster">
    <div class="ep-wrap left">
      <canvas class="ep-canvas" id="epCanvasLeft"></canvas>
      <div class="ep-glow-1"></div>
      <div class="ep-glow-2"></div>
      <div class="ep-bg-glow"></div>
      <div class="swatch-panel" id="leftPanel">
        <div class="swatch-row">
          <div class="ps" id="lp0"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp1"><span class="ps-override-x">×</span></div>
        </div>
        <div class="swatch-row">
          <div class="ps" id="lp2"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp3"><span class="ps-override-x">×</span></div>
        </div>
        <div class="swatch-row">
          <div class="ps" id="lp4"><span class="ps-override-x">×</span></div>
          <div class="ps" id="lp5"><span class="ps-override-x">×</span></div>
        </div>
      </div>
    </div>

    <!-- left-side floating tables: Palette, Status, Backgrounds, Fonts, Opacity -->
    <div class="left-legend-wrap">
      <div class="legend-panel desktop" id="colorLegendDesktop"></div>
      <div class="hud" style="pointer-events:none">
        <div class="hud-title">Status</div>
        <div class="hud-row"><span class="hud-label">Hue</span><span class="hud-value" id="hudHue">000°</span></div>
        <div class="hud-row"><span class="hud-label">Mode</span><span class="hud-value" id="hudHarmony">Complementary</span></div>
        <div class="hud-row"><span class="hud-label">Sync</span><span class="hud-value" id="hudSync">Active</span></div>
      </div>
      <div class="quick-panel">
        <div class="hud-title">Backgrounds</div>
        <div class="qp-row">
          <span class="qp-label">Thpace Particles</span>
          <label class="bg-toggle-pill">
            <input type="checkbox" id="thpaceToggle">
            <span class="bg-toggle-track"></span>
          </label>
        </div>
        <div class="qp-row">
          <span class="qp-label">Effect</span>
          <div class="qp-select-wrap">
            <select id="bgEffectSelect">
              <option value="none">None</option>
              <option value="kaleidoscope">Kaleidoscope</option>
              <option value="aurora">Aurora</option>
              <option value="nebula">Nebula</option>
              <option value="crt">CRT</option>
              <option value="circuit">Circuit</option>
              <option value="meshflow">Meshflow</option>
              <option value="playstation">Playstation</option>
              <option value="image">Image</option>
            </select>
          </div>
        </div>
        <div class="qp-row">
          <span class="qp-label">BG Effect</span>
          <label class="bg-toggle-pill">
            <input type="checkbox" id="bgEffectToggle">
            <span class="bg-toggle-track"></span>
          </label>
        </div>
      </div>
      <!-- Fonts and Opacity moved to right side -->
    </div>
    </div><!-- /left-cluster -->

    <!-- center wheel + controls -->
    <div class="center-col">
      <div class="wheel-wrap">
        <div class="wheel-glow"></div>
        <canvas id="hueWheel" width="220" height="220"></canvas>
        <div class="wheel-void">
          <span class="wheel-hue-num" id="wheelHueNum">200</span>
        </div>
      </div>

      <div class="harmony-row" id="harmonyRow">
        <button class="hbtn active" data-harmony="complementary">Comp</button>
        <button class="hbtn" data-harmony="triadic">Triadic</button>
        <button class="hbtn" data-harmony="split">Split</button>
        <button class="hbtn" data-harmony="analogous">Analog</button>
        <button class="hbtn" data-harmony="tetradic">Tetra</button>
        <button class="hbtn" data-harmony="monochromatic">Mono</button>
      </div>

      <div class="name-row">
        <input type="text" id="sessionNameInput" class="session-name-input" placeholder="Session name..." value="Untitled" maxlength="40" autocomplete="off" spellcheck="false">
      </div>
      <div class="action-row">
        <button class="btn-rand" id="randomBtn">⟳ Random</button>
        <button class="btn-save btn-rand" id="saveBtn">⊛ Save</button>
        <button class="btn-apply" id="applyBtn">⬡ Apply</button>
      </div>

      <div class="legend-panel mobile" id="colorLegendMobile"></div>
    </div>

    <!-- right swatch panel + anchored legend -->
    <div class="right-cluster">
      <div class="ep-wrap right">
        <canvas class="ep-canvas" id="epCanvasRight"></canvas>
        <div class="ep-glow-1"></div>
        <div class="ep-glow-2"></div>
        <div class="ep-bg-glow"></div>
        <div class="swatch-panel" id="rightPanel">
          <div class="swatch-row">
            <div class="ps" id="rp0"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp1"><span class="ps-override-x">×</span></div>
          </div>
          <div class="swatch-row">
            <div class="ps" id="rp2"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp3"><span class="ps-override-x">×</span></div>
          </div>
          <div class="swatch-row">
            <div class="ps" id="rp4"><span class="ps-override-x">×</span></div>
            <div class="ps" id="rp5"><span class="ps-override-x">×</span></div>
          </div>
        </div>
      </div>
      <div class="right-legend-wrap">
        <div class="quick-panel" id="fontsPanel">
          <div class="hud-title">Fonts</div>
          <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
        </div>
        <div class="quick-panel" id="opacityPanel">
          <div class="hud-title">Opacity</div>
          <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
        </div>
      </div>
    </div>
  </div>
  <div class="tables-below" style="display:none">
    <div class="quick-panel" id="bgPanel_below">
      <div class="hud-title">Backgrounds</div>
      <div class="qp-row">
        <span class="qp-label">Thpace Particles</span>
        <label class="bg-toggle-pill"><input type="checkbox" id="thpaceToggle_below"><span class="bg-toggle-track"></span></label>
      </div>
      <div class="qp-row">
        <span class="qp-label">Effect</span>
        <div class="qp-select-wrap">
          <select id="bgEffectSelect_below">
            <option value="none">None</option>
            <option value="kaleidoscope">Kaleidoscope</option>
            <option value="aurora">Aurora</option>
            <option value="nebula">Nebula</option>
            <option value="crt">CRT</option>
            <option value="circuit">Circuit</option>
            <option value="meshflow">Meshflow</option>
            <option value="playstation">Playstation</option>
            <option value="image">Image</option>
          </select>
        </div>
      </div>
      <div class="qp-row">
        <span class="qp-label">BG Effect</span>
        <label class="bg-toggle-pill"><input type="checkbox" id="bgEffectToggle_below"><span class="bg-toggle-track"></span></label>
      </div>
    </div>
    <div class="quick-panel" id="fontsPanel_below">
      <div class="hud-title">Fonts</div>
      <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
    </div>
    <div class="quick-panel" id="opacityPanel_below">
      <div class="hud-title">Opacity</div>
      <div style="font-size:0.56rem;padding:4px 2px;color:rgba(180,200,255,0.45)">Load config to edit.</div>
    </div>
  </div>
</div>

<!-- ── apply overwrite confirm modal ─────────────────────────────────────── -->
<div class="override-modal-bg" id="saveConfirmModal">
  <div class="override-modal" style="max-width:320px;gap:12px;">
    <div class="override-modal-title">Save Session</div>
    <div style="font-size:0.72rem;letter-spacing:0.8px;color:rgba(185,210,255,0.82);text-align:center;line-height:1.5;">
      You are editing an existing session card.<br>What would you like to do?
    </div>
    <div class="override-btn-row" style="flex-direction:column;gap:6px;">
      <button class="override-btn confirm" id="saveConfirmOverwriteBtn">Overwrite existing card</button>
      <button class="override-btn" id="saveConfirmNewBtn">Save as new card</button>
      <button class="override-btn" id="saveConfirmCancelBtn" style="color:rgba(180,200,255,0.45);border-color:rgba(255,255,255,0.07);">Cancel</button>
    </div>
  </div>
</div>

<!-- ── variables panel ────────────────────────────────────────────────────── -->
<div class="vars-panel">
  <div class="vars-panel-header">
    <span class="vars-panel-title">&#9672; Variables</span>
    <div class="vars-toggle-row">
      <span class="vars-toggle-label" id="varsToggleLabel">Simple</span>
      <button class="vars-toggle-btn" id="varsToggleBtn" title="Toggle advanced mode">&#9662;</button>
    </div>
  </div>
  <div class="vars-content" id="varsContent">
    <div class="v-empty">Variables load after first Apply.</div>
  </div>
</div>

<script>
(function() {
// ── stub vscode (replace with acquireVsCodeApi() in extension) ──────────────
const vscode = (typeof acquireVsCodeApi !== 'undefined')
  ? acquireVsCodeApi()
  : { postMessage: (m) => console.log('[vscode msg]', m) };

// ── wheel setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('hueWheel');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const CX = W / 2, CY = H / 2;
const OUTER = 104, INNER = 66, INDICATOR_R = 87;
const TWO_PI = Math.PI * 2;

let baseHue = 200;
let harmony = 'complementary';
let palette = [];
let dragging = false;
const overrides = {};
let currentSessionId = null;
let sessionName = 'Untitled';
let activePresetId = null;
const HARMONIES = ['complementary', 'triadic', 'split', 'analogous', 'tetradic', 'monochromatic'];
const ROLE_NAMES = ['accent-1', 'accent-2', 'accent-3', 'accent-4', 'surface-1', 'surface-2'];

// ── draw wheel ────────────────────────────────────────────────────────────────
function drawWheel() {
  ctx.clearRect(0, 0, W, H);

  // hue ring — fill with hue segments
  const SEGMENTS = 360;
  for (let i = 0; i < SEGMENTS; i++) {
    const s = (i - 1) * TWO_PI / SEGMENTS - Math.PI / 2;
    const e = (i + 1) * TWO_PI / SEGMENTS - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(CX + INNER * Math.cos(s), CY + INNER * Math.sin(s));
    ctx.arc(CX, CY, OUTER, s, e);
    ctx.arc(CX, CY, INNER, e, s, true);
    ctx.closePath();
    ctx.fillStyle = \`hsl(\${i},90%,55%)\`;
    ctx.fill();
  }

  // grid overlay — concentric rings
  const ringCount = 5;
  for (let r = 0; r <= ringCount; r++) {
    const rad = INNER + (OUTER - INNER) * r / ringCount;
    ctx.beginPath();
    ctx.arc(CX, CY, rad, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // radial spokes
  const spokeCount = 24;
  for (let i = 0; i < spokeCount; i++) {
    const angle = i * TWO_PI / spokeCount - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(CX + INNER * Math.cos(angle), CY + INNER * Math.sin(angle));
    ctx.lineTo(CX + OUTER * Math.cos(angle), CY + OUTER * Math.sin(angle));
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // outer glow ring
  const gg = ctx.createRadialGradient(CX, CY, OUTER - 1, CX, CY, OUTER + 4);
  gg.addColorStop(0, \`hsla(\${baseHue},100%,65%,0.6)\`);
  gg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(CX, CY, OUTER + 2, 0, TWO_PI);
  ctx.strokeStyle = gg;
  ctx.lineWidth = 5;
  ctx.stroke();

  // inner edge glow
  const ig = ctx.createRadialGradient(CX, CY, INNER - 3, CX, CY, INNER + 1);
  ig.addColorStop(0, 'transparent');
  ig.addColorStop(1, \`hsla(\${baseHue},100%,70%,0.35)\`);
  ctx.beginPath();
  ctx.arc(CX, CY, INNER, 0, TWO_PI);
  ctx.strokeStyle = ig;
  ctx.lineWidth = 3;
  ctx.stroke();

  // indicator dot
  const angle = baseHue * Math.PI / 180 - Math.PI / 2;
  const ix = CX + INDICATOR_R * Math.cos(angle);
  const iy = CY + INDICATOR_R * Math.sin(angle);

  // outer ring
  ctx.beginPath();
  ctx.arc(ix, iy, 8, 0, TWO_PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // inner fill
  ctx.beginPath();
  ctx.arc(ix, iy, 5, 0, TWO_PI);
  ctx.fillStyle = \`hsl(\${baseHue},90%,65%)\`;
  ctx.fill();

  // glow halo on indicator
  const indGlow = ctx.createRadialGradient(ix, iy, 0, ix, iy, 14);
  indGlow.addColorStop(0, \`hsla(\${baseHue},100%,70%,0.6)\`);
  indGlow.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(ix, iy, 14, 0, TWO_PI);
  ctx.fillStyle = indGlow;
  ctx.fill();
}

// ── harmony generation ────────────────────────────────────────────────────────
function hsl2hex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2,'0')).join('');
}

function generateHarmony() {
  const h = baseHue;
  const map = {
    complementary: [
      {h,s:88,l:55},{h:(h+180)%360,s:82,l:52},
      {h,s:60,l:38},{h:(h+180)%360,s:55,l:72},
      {h,s:30,l:82},{h:(h+180)%360,s:30,l:28}
    ],
    triadic: [
      {h,s:85,l:55},{h:(h+120)%360,s:80,l:52},{h:(h+240)%360,s:85,l:56},
      {h,s:40,l:38},{h:(h+120)%360,s:38,l:74},{h:(h+240)%360,s:42,l:82}
    ],
    split: [
      {h,s:85,l:54},{h:(h+150)%360,s:72,l:44},{h:(h+210)%360,s:76,l:56},
      {h,s:40,l:82},{h:(h+150)%360,s:55,l:30},{h:(h+210)%360,s:35,l:76}
    ],
    analogous: [
      {h,s:85,l:55},{h:(h+30)%360,s:78,l:52},{h:(h+330)%360,s:80,l:50},
      {h:(h+60)%360,s:60,l:42},{h,s:40,l:78},{h:(h+300)%360,s:45,l:32}
    ],
    tetradic: [
      {h,s:85,l:55},{h:(h+90)%360,s:80,l:52},{h:(h+180)%360,s:85,l:50},{h:(h+270)%360,s:78,l:54},
      {h,s:40,l:82},{h:(h+180)%360,s:38,l:28}
    ],
    monochromatic: [
      {h,s:85,l:60},{h,s:75,l:45},{h,s:60,l:32},
      {h,s:45,l:72},{h,s:30,l:82},{h,s:90,l:18}
    ]
  };
  return (map[harmony] || map.complementary).map(({h,s,l}) => hsl2hex(h,s,l));
}

// ── update all UI for new palette/hue ────────────────────────────────────────
function updateUI(live = false) {
  palette = generateHarmony().map((col, i) => overrides[i] !== undefined ? overrides[i] : col);
  drawWheel();

  // center hue readout
  const hueNumEl = document.getElementById('wheelHueNum');
  if (hueNumEl) {
    const rh = Math.round(baseHue);
    hueNumEl.textContent = String(rh);
    hueNumEl.style.color = \`hsl(\${rh},90%,75%)\`;
    hueNumEl.style.textShadow = \`0 0 10px hsl(\${rh},100%,65%), 0 0 22px hsl(\${rh},100%,55%)\`;
  }

  // update dynamic accent color from primary palette color
  const [r0, g0, b0] = [parseInt(palette[0].slice(1,3),16), parseInt(palette[0].slice(3,5),16), parseInt(palette[0].slice(5,7),16)];
  document.documentElement.style.setProperty('--ui-accent', palette[0]);
  document.documentElement.style.setProperty('--ui-accent-rgb', \`\${r0},\${g0},\${b0}\`);

  // side panels
  for (let i = 0; i < 6; i++) {
    const col = palette[i] || '#111';
    const lp = document.getElementById(\`lp\${i}\`);
    const rp = document.getElementById(\`rp\${i}\`);
    if (lp) { lp.style.background = col; lp.style.setProperty('--glow', col + '88'); }
    if (rp) { rp.style.background = col; rp.style.setProperty('--glow', col + '88'); }
  }

  // ambient background
  updateAmbient(live);

  // right-side labeled legend (desktop) + under-buttons legend (mobile)
  updateLegend('colorLegendDesktop');
  updateLegend('colorLegendMobile');

  // wheel glow color — use rgba, not hex+alpha (avoids canvas filter bug)
  canvas.style.filter = \`drop-shadow(0 0 10px rgba(\${r0},\${g0},\${b0},0.75)) drop-shadow(0 0 30px rgba(\${r0},\${g0},\${b0},0.45))\`;

  // update wheel glow div color dynamically
  const wg = document.querySelector('.wheel-glow');
  if (wg) wg.style.background = \`radial-gradient(circle, rgba(\${r0},\${g0},\${b0},0.35) 0%, rgba(\${r0},\${g0},\${b0},0.14) 45%, transparent 70%)\`;

  // HUD
  document.getElementById('hudHue').textContent = \`\${String(Math.round(baseHue)).padStart(3,'0')}°\`;
  document.getElementById('hudHarmony').textContent = harmony.charAt(0).toUpperCase() + harmony.slice(1);
  // keep picker bridge in sync
  if (window._codexPalette) window._codexPalette = palette;
  // Update sidebar card swatches to reflect current palette on every finalize
  if (!live) {
    vscode.postMessage({ command: 'CodexUpdate', colors: palette });
  }
}

function hex2rgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return \`rgba(\${r},\${g},\${b},\${a})\`;
}

function updateAmbient(live) {
  const bg = document.getElementById('ambientBg');
  bg.style.background = 'transparent';
}

function copyHex(hex) {
  if (navigator.clipboard) navigator.clipboard.writeText(hex).catch(()=>{});
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * (((bn - rn) / d) + 2);
    else h = 60 * (((rn - gn) / d) + 4);
  }

  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function getColorNameFromHex(hex) {
  const table = {
    "#f0f8ff": "Alice Blue", "#faebd7": "Antique White", "#00ffff": "Aqua", "#7fffd4": "Aquamarine", "#f0ffff": "Azure", 
    "#f5f5dc": "Beige", "#ffe4c4": "Bisque", "#000000": "Black", "#ffebcd": "Blanched Almond", "#0000ff": "Blue", 
    "#8a2be2": "Blue Violet", "#a52a2a": "Brown", "#deb887": "Burlywood", "#5f9ea0": "Cadet Blue", "#7fff00": "Chartreuse", 
    "#d2691e": "Chocolate", "#ff7f50": "Coral", "#6495ed": "Cornflower Blue", "#fff8dc": "Cornsilk", "#dc143c": "Crimson", 
    "#00008b": "Dark Blue", "#008b8b": "Dark Cyan", "#b8860b": "Dark Goldenrod", "#a9a9a9": "Dark Gray", "#006400": "Dark Green", 
    "#bdb76b": "Dark Khaki", "#8b008b": "Dark Magenta", "#556b2f": "Dark Olive Green", "#ff8c00": "Dark Orange", "#9932cc": "Dark Orchid", 
    "#8b0000": "Dark Red", "#e9967a": "Dark Salmon", "#8fbc8f": "Dark Sea Green", "#483d8b": "Dark Slate Blue", "#2f4f4f": "Dark Slate Gray", 
    "#00ced1": "Dark Turquoise", "#9400d3": "Dark Violet", "#ff1493": "Deep Pink", "#00bfff": "Deep Sky Blue", "#696969": "Dim Gray", 
    "#1e90ff": "Dodger Blue", "#b22222": "Firebrick", "#fffaf0": "Floral White", "#228b22": "Forest Green", "#dcdcdc": "Gainsboro", 
    "#f8f8ff": "Ghost White", "#ffd700": "Gold", "#daa520": "Goldenrod", "#808080": "Gray", "#008000": "Green", 
    "#adff2f": "Green Yellow", "#f0fff0": "Honeydew", "#ff69b4": "Hot Pink", "#cd5c5c": "Indian Red", "#4b0082": "Indigo", 
    "#fffff0": "Ivory", "#f0e68c": "Khaki", "#e6e6fa": "Lavender", "#fff0f5": "Lavender Blush", "#7cfc00": "Lawn Green", 
    "#fffacd": "Lemon Chiffon", "#add8e6": "Light Blue", "#f08080": "Light Coral", "#e0ffff": "Light Cyan", "#fafad2": "Light Goldenrod Yellow", 
    "#d3d3d3": "Light Gray", "#90ee90": "Light Green", "#ffb6c1": "Light Pink", "#ffa07a": "Light Salmon", "#20b2aa": "Light Sea Green", 
    "#87cefa": "Light Sky Blue", "#778899": "Light Slate Gray", "#b0c4de": "Light Steel Blue", "#ffffe0": "Light Yellow", "#00ff00": "Lime", 
    "#32cd32": "Lime Green", "#faf0e6": "Linen", "#ff00ff": "Magenta", "#800000": "Maroon", "#66cdaa": "Medium Aquamarine", 
    "#0000cd": "Medium Blue", "#ba55d3": "Medium Orchid", "#9370db": "Medium Purple", "#3cb371": "Medium Sea Green", "#7b68ee": "Medium Slate Blue", 
    "#00fa9a": "Medium Spring Green", "#48d1cc": "Medium Turquoise", "#c71585": "Medium Violet Red", "#191970": "Midnight Blue", "#f5fffa": "Mint Cream", 
    "#ffe4e1": "Misty Rose", "#ffe4b5": "Moccasin", "#ffdead": "Navajo White", "#000080": "Navy", "#fdf5e6": "Old Lace", 
    "#808000": "Olive", "#6b8e23": "Olive Drab", "#ffa500": "Orange", "#ff4500": "Orange Red", "#da70d6": "Orchid", 
    "#eee8aa": "Pale Goldenrod", "#98fb98": "Pale Green", "#afeeee": "Pale Turquoise", "#db7093": "Pale Violet Red", "#ffefd5": "Papaya Whip", 
    "#ffdab9": "Peach Puff", "#cd853f": "Peru", "#ffc0cb": "Pink", "#dda0dd": "Plum", "#b0e0e6": "Powder Blue", 
    "#800080": "Purple", "#663399": "Rebecca Purple", "#ff0000": "Red", "#bc8f8f": "Rosy Brown", "#4169e1": "Royal Blue", 
    "#8b4513": "Saddle Brown", "#fa8072": "Salmon", "#f4a460": "Sandy Brown", "#2e8b57": "Sea Green", "#fff5ee": "Seashell", 
    "#a0522d": "Sienna", "#c0c0c0": "Silver", "#87ceeb": "Sky Blue", "#6a5acd": "Slate Blue", "#708090": "Slate Gray", 
    "#fffafa": "Snow", "#00ff7f": "Spring Green", "#4682b4": "Steel Blue", "#d2b48c": "Tan", "#008080": "Teal", 
    "#d8bfd8": "Thistle", "#ff6347": "Tomato", "#40e0d0": "Turquoise", "#ee82ee": "Violet", "#f5deb3": "Wheat", 
    "#ffffff": "White", "#f5f5f5": "White Smoke", "#ffff00": "Yellow", "#9acd32": "Yellow Green"
  };

  const { r, g, b } = hexToRgb(hex);
  let closestName = "Unknown";
  let minDist = Infinity;

  for (const k in table) {
    if (Object.prototype.hasOwnProperty.call(table, k)) {
      const rc = parseInt(k.substring(1, 3), 16);
      const gc = parseInt(k.substring(3, 5), 16);
      const bc = parseInt(k.substring(5, 7), 16);
      
      const dist = Math.pow(r - rc, 2) + Math.pow(g - gc, 2) + Math.pow(b - bc, 2);
      if (dist < minDist) {
        minDist = dist;
        closestName = table[k];
      }
    }
  }

  return closestName;
}

function updateLegend(targetId) {
  const legend = document.getElementById(targetId);
  if (!legend) return;
  legend.innerHTML = '<div class="legend-title">Palette Roles</div>' +
    palette.map((hex, i) => {
      const role = ROLE_NAMES[i] || ('Color ' + (i + 1));
      const colorName = getColorNameFromHex(hex);
      return (
        '<div class="legend-row">' +
          '<span class="legend-dot" style="background:' + hex + ';--lg:' + hex + ';"></span>' +
          '<span class="legend-meta"><span class="legend-name">' + role + '</span><span class="legend-color-name">' + colorName + '</span></span>' +
          '<span class="legend-hex" data-hex="' + hex + '">' + hex.toUpperCase() + '</span>' +
        '</div>'
      );
    }).join('');
}

function bindLegendClicks(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.addEventListener('click', (e) => {
    const item = e.target.closest('.legend-hex');
    if (!item) return;
    const hex = item.getAttribute('data-hex');
    if (hex) copyHex(hex);
  });
}

bindLegendClicks('colorLegendDesktop');
bindLegendClicks('colorLegendMobile');

// ── pointer input ─────────────────────────────────────────────────────────────
function hueFromPointer(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width, scaleY = H / rect.height;
  const cx = e.clientX !== undefined ? e.clientX : e.touches[0].clientX;
  const cy = e.clientY !== undefined ? e.clientY : e.touches[0].clientY;
  const x = (cx - rect.left) * scaleX - CX;
  const y = (cy - rect.top)  * scaleY - CY;
  const dist = Math.sqrt(x*x + y*y);
  if (dist < INNER * 0.6 || dist > OUTER * 1.15) return null;
  return ((Math.atan2(y, x) * 180 / Math.PI + 90) + 360) % 360;
}

canvas.addEventListener('mousedown', e => {
  const h = hueFromPointer(e);
  if (h === null) return;
  dragging = true;
  baseHue = h;
  // Clear swatch overrides when user actively drags the wheel so hue takes effect
  Object.keys(overrides).forEach(k => delete overrides[k]);
  canvas.style.cursor = 'none';
  updateUI(true);
});
canvas.addEventListener('mousemove', e => {
  if (!dragging) return;
  const h = hueFromPointer(e);
  if (h === null) return;
  baseHue = h;
  updateUI(true);
});

canvas.addEventListener('mouseup', () => {
  dragging = false;
  canvas.style.cursor = 'crosshair';
  updateUI(false); // Finalize palette/UI after drag or click
});
canvas.addEventListener('click', (e) => {
  const h = hueFromPointer(e);
  if (h !== null) {
    baseHue = h;
    // Clear overrides so hue change is visible (same as drag-start)
    if (!dragging) { Object.keys(overrides).forEach(k => delete overrides[k]); }
    updateUI(false);
  }
});
window.addEventListener('mouseup', () => {
  if (dragging) {
    dragging = false;
    canvas.style.cursor = 'crosshair';
    updateUI(false);
  }
});
window.addEventListener('touchend', () => {
  if (dragging) {
    dragging = false;
    updateUI(false);
  }
});
window.addEventListener('touchcancel', () => {
  if (dragging) {
    dragging = false;
    updateUI(false);
  }
});
canvas.addEventListener('mouseleave', () => {
  if (dragging) {
    dragging = false;
    canvas.style.cursor = 'crosshair';
    updateUI(false); // Finalize if mouse leaves while dragging
  }
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const h = hueFromPointer(e);
  if (h === null) return;
  dragging = true;
  baseHue = h;
  Object.keys(overrides).forEach(k => delete overrides[k]);
  updateUI(true);
}, {passive: false});
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!dragging) return;
  const h = hueFromPointer(e);
  if (h !== null) { baseHue = h; updateUI(true); }
}, {passive: false});
canvas.addEventListener('touchend', () => {
  dragging = false;
  updateUI(false); // Finalize palette/UI after touch interaction
});

// ── harmony buttons ───────────────────────────────────────────────────────────
document.getElementById('harmonyRow').addEventListener('click', e => {
  const btn = e.target.closest('.hbtn');
  if (!btn) return;
  harmony = btn.dataset.harmony;
  document.querySelectorAll('.hbtn').forEach(b => b.classList.toggle('active', b === btn));
  updateUI(false);
});

// ── button ripple helper ──────────────────────────────────────────────────────
function triggerBtnAnim(btn, e) {
  btn.style.animation = 'none';
  btn.offsetHeight; // reflow
  btn.style.animation = 'btnPop 0.35s ease';
  const rect = btn.getBoundingClientRect();
  const rip = document.createElement('span');
  rip.className = 'btn-ripple';
  rip.style.left = (e.clientX - rect.left) + 'px';
  rip.style.top  = (e.clientY - rect.top)  + 'px';
  btn.appendChild(rip);
  rip.addEventListener('animationend', () => rip.remove());
}

// ── random ────────────────────────────────────────────────────────────────────
document.getElementById('randomBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('randomBtn'), e);
  baseHue = Math.random() * 360;
  harmony = HARMONIES[Math.floor(Math.random() * HARMONIES.length)];
  // Clear swatch overrides so all colors derive from the new hue
  Object.keys(overrides).forEach(k => delete overrides[k]);
  document.querySelectorAll('.hbtn').forEach((b) => {
    b.classList.toggle('active', b.dataset.harmony === harmony);
  });
  updateUI(false);
});

// ── apply ─────────────────────────────────────────────────────────────────────
function doApply(sessionId) {
  const name = (document.getElementById('sessionNameInput')?.value || '').trim() || 'Untitled';
  sessionName = name;
  vscode.postMessage({ command: 'applySession', sessionId, name, baseHue, harmony, swatchOverrides: JSON.parse(JSON.stringify(overrides)), colors: palette, bgEffect: (varsState.values['--ftr10-bg-effect'] || 'nebula'), thpaceEnabled: (varsState.values['--ftr10-thpace-enabled'] || 'true'), vars: JSON.parse(JSON.stringify(varsState.values)) });
  vscode.postMessage({ command: 'CodexUpdate', colors: palette });
  const btn = document.getElementById('applyBtn');
  btn.textContent = '\u2713 Applied';
  btn.style.boxShadow = \`0 0 28px rgba(\${document.documentElement.style.getPropertyValue('--ui-accent-rgb')},0.7)\`;
  setTimeout(() => {
    btn.textContent = '\u2B21 Apply';
    btn.style.boxShadow = '';
  }, 1200);
}

document.getElementById('applyBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('applyBtn'), e);
  doApply(currentSessionId);
});

// ── save ──────────────────────────────────────────────────────────────────────
function doSave(sessionId) {
  const name = (document.getElementById('sessionNameInput')?.value || '').trim() || 'Untitled';
  sessionName = name;
  vscode.postMessage({ command: 'saveSession', sessionId, name, baseHue, harmony, swatchOverrides: JSON.parse(JSON.stringify(overrides)), colors: palette, bgEffect: (varsState.values['--ftr10-bg-effect'] || 'nebula'), thpaceEnabled: (varsState.values['--ftr10-thpace-enabled'] || 'true'), vars: JSON.parse(JSON.stringify(varsState.values)) });
  const btn = document.getElementById('saveBtn');
  btn.textContent = '\u2713 Saved';
  setTimeout(() => { btn.textContent = '\u229B Save'; }, 1200);
}
document.getElementById('saveBtn').addEventListener('click', (e) => {
  triggerBtnAnim(document.getElementById('saveBtn'), e);
  if (currentSessionId) {
    // Editing an existing card — prompt overwrite vs new
    document.getElementById('saveConfirmModal').classList.add('open');
  } else {
    doSave(null);
  }
});

// ── vars panel state ──────────────────────────────────────────────────────────
const varsState = { simpleGroups: [], values: {}, sections: [], advanced: false };

const FONT_OPTIONS_A = ["inherit",'Cartograph','DM Mono','Exo 2','Fira Code','JetBrains Mono','Monaspace Krypton','Monaspace Radon','Orbitron','Oxanium','Rajdhani','Recursive','Silkscreen','Space Grotesk','Victor Mono','Victor Mono NF'];
const SELECT_OPTIONS_A = {
      '--ftr10-bg-effect': ['none', 'image', 'kaleidoscope', 'aurora', 'nebula', 'crt', 'circuit', 'meshflow', 'playstation'],
  '--ftr10-code-font': FONT_OPTIONS_A, '--ftr10-font-activitybar': FONT_OPTIONS_A,
  '--ftr10-font-sidebar': FONT_OPTIONS_A, '--ftr10-font-panel-bottom': FONT_OPTIONS_A,
  '--ftr10-font-panel-top': FONT_OPTIONS_A, '--ftr10-font-auxiliarybar': FONT_OPTIONS_A
};

function escapeHtmlA(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
function isHexA(v) { return /^#[0-9a-f]{6,8}$/i.test((v||'').trim()); }
function toPickerHexA(v) { const h=(v||'').trim(); return h.length>=7?h.slice(0,7):'#000000'; }
function hexAlphaA(v) { const h=(v||'').trim(); return h.length===9?Math.round(parseInt(h.slice(7,9),16)/255*100):100; }

function buildVarsFieldRow(key, value) {
  const opts = SELECT_OPTIONS_A[key];
  let html = '<div class="v-field-row">';
  html += '<div class="v-field-label" title="' + escapeHtmlA(key) + '">' + escapeHtmlA(key.replace('--ftr10-','')) + '</div>';
  html += '<div class="v-field-input-wrap">';
  if (opts) {
    html += '<div class="v-select-wrap"><select data-vkey="' + escapeHtmlA(key) + '">';
    opts.forEach(o => { html += '<option value="' + escapeHtmlA(o) + '"' + (o === value ? ' selected' : '') + '>' + escapeHtmlA(o) + '</option>'; });
    html += '</select></div>';
  } else {
    const sp = isHexA(value);
    const alpha = sp ? hexAlphaA(value) : 100;
    if (sp) {
      html += '<input type="color" data-vkey="' + escapeHtmlA(key) + '" data-vrole="picker" value="' + escapeHtmlA(toPickerHexA(value)) + '"/>';
      html += '<div class="v-alpha-wrap" style="--sw:' + escapeHtmlA(toPickerHexA(value)) + '">';
      html += '<input type="range" min="0" max="100" value="' + alpha + '" data-vkey="' + escapeHtmlA(key) + '" data-vrole="alpha"/>';
      html += '<span class="v-alpha-label" data-vkey="' + escapeHtmlA(key) + '" data-vrole="alpha-label">' + alpha + '%</span>';
      html += '</div>';
    }
    html += '<input type="text" data-vkey="' + escapeHtmlA(key) + '" data-vrole="text" value="' + escapeHtmlA(value||'') + '" placeholder="CSS value"/>';
  }
  html += '</div></div>';
  return html;
}

function renderVarsPanel() {
  const content = document.getElementById('varsContent');
  if (!content) return;
  let html = '';
  const groups = varsState.advanced ? varsState.sections : varsState.simpleGroups;
  groups.forEach(group => {
    const label = group.label || group.name || '';
    const keys = (group.keys || []);
    if (keys.length === 0) return;
    html += '<details class="v-group" open>';
    html += '<summary class="v-group-header">' + escapeHtmlA(label) + '<span class="v-count">' + keys.length + '</span></summary>';
    html += '<div class="v-group-fields">';
    keys.forEach(k => { html += buildVarsFieldRow(k, varsState.values[k] !== undefined ? varsState.values[k] : ''); });
    html += '</div></details>';
  });
  if (!html) html = '<div class="v-empty">No variables loaded yet. Variables appear once a session is applied.</div>';
  content.innerHTML = html;
  wireVarsInputs(content);
  // Sync bg toggles to current state
  syncBgToggleState(varsState.values);
}

let _varsLiveTimer = null;
function scheduleVarsLiveUpdate() {
  clearTimeout(_varsLiveTimer);
  _varsLiveTimer = setTimeout(() => {
    // User spec: only palette colors and colors generated from palette should auto-update.
    // Backgrounds, fonts, etc. must NOT live-update (need Apply). So filter to palette-derived keys.
    var PALETTE_LIVE_RE = /^(--ftr10-accent-[1234](?:-\d+)?|--ftr10-surface-[12](?:-\d+)?|--ftr10-cursor|--ftr10-tab-border-color|--ftr10-bg-ambient|--ftr10-border|--ftr10-token-)/;
    var filtered = {};
    for (var _e of Object.entries(varsState.values)) {
      var _k = _e[0], _v = _e[1];
      if (PALETTE_LIVE_RE.test(_k) || _k === '--ftr10-accent-1' || _k === '--ftr10-accent-2' || _k === '--ftr10-accent-3' || _k === '--ftr10-accent-4') {
        filtered[_k]=_v;
      }
    }
    if (Object.keys(filtered).length === 0) return;
    vscode.postMessage({ command: 'liveUpdate', values: filtered });
  }, 400);
}

function wireVarsInputs(content) {
  content.querySelectorAll('input[data-vrole="picker"]').forEach(picker => {
    picker.addEventListener('input', () => {
      const key = picker.dataset.vkey;
      const alphaEl = content.querySelector('input[data-vrole="alpha"][data-vkey="' + CSS.escape(key) + '"]');
      const textEl = content.querySelector('input[data-vrole="text"][data-vkey="' + CSS.escape(key) + '"]');
      const alphaWrap = content.querySelector('.v-alpha-wrap:has(input[data-vkey="' + CSS.escape(key) + '"])');
      const alpha = alphaEl ? parseInt(alphaEl.value) : 100;
      const alphaHex = Math.round(alpha/100*255).toString(16).padStart(2,'0');
      const newVal = alpha === 100 ? picker.value : picker.value + alphaHex;
      varsState.values[key] = newVal;
      if (textEl && textEl !== document.activeElement) textEl.value = newVal;
      if (alphaWrap) alphaWrap.style.setProperty('--sw', picker.value);
      scheduleVarsLiveUpdate();
    });
  });
  content.querySelectorAll('input[data-vrole="alpha"]').forEach(slider => {
    slider.addEventListener('input', () => {
      const key = slider.dataset.vkey;
      const pickerEl = content.querySelector('input[data-vrole="picker"][data-vkey="' + CSS.escape(key) + '"]');
      const labelEl = content.querySelector('[data-vrole="alpha-label"][data-vkey="' + CSS.escape(key) + '"]');
      const textEl = content.querySelector('input[data-vrole="text"][data-vkey="' + CSS.escape(key) + '"]');
      if (labelEl) labelEl.textContent = slider.value + '%';
      if (pickerEl) {
        const alphaHex = Math.round(parseInt(slider.value)/100*255).toString(16).padStart(2,'0');
        const newVal = parseInt(slider.value) === 100 ? pickerEl.value : pickerEl.value + alphaHex;
        varsState.values[key] = newVal;
        if (textEl && textEl !== document.activeElement) textEl.value = newVal;
        scheduleVarsLiveUpdate();
      }
    });
  });
  content.querySelectorAll('input[data-vrole="text"]').forEach(txt => {
    txt.addEventListener('change', () => {
      varsState.values[txt.dataset.vkey] = txt.value;
      scheduleVarsLiveUpdate();
    });
  });
  content.querySelectorAll('select[data-vkey]').forEach(sel => {
    sel.addEventListener('change', () => {
      varsState.values[sel.dataset.vkey] = sel.value;
      scheduleVarsLiveUpdate();
    });
  });
}

// ── save confirm modal wiring ───────────────────────────────────────────────────
document.getElementById('saveConfirmOverwriteBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
  doSave(currentSessionId);
});
document.getElementById('saveConfirmNewBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
  doSave(null);
});
document.getElementById('saveConfirmCancelBtn').addEventListener('click', () => {
  document.getElementById('saveConfirmModal').classList.remove('open');
});
document.getElementById('saveConfirmModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('saveConfirmModal')) {
    document.getElementById('saveConfirmModal').classList.remove('open');
  }
});

// ── vars panel toggle ────────────────────────────────────────────────────────
document.getElementById('varsToggleBtn').addEventListener('click', () => {
  varsState.advanced = !varsState.advanced;
  document.getElementById('varsToggleLabel').textContent = varsState.advanced ? 'Advanced' : 'Simple';
  renderVarsPanel();
});

// ── session messages from extension ───────────────────────────────────────────
window.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg.command === 'loadSession' && msg.session) {
    // Cancel any pending deferred update from the previous session before switching
    clearTimeout(_varsLiveTimer);
    _varsLiveTimer = null;
    const s = msg.session;
    currentSessionId = s.id;
    sessionName = s.name;
    baseHue = typeof s.baseHue === 'number' ? s.baseHue : baseHue;
    harmony = s.harmony || harmony;
    // Restore swatch overrides
    Object.keys(overrides).forEach(k => delete overrides[k]);
    if (s.swatchOverrides) { Object.assign(overrides, s.swatchOverrides); }
    // Sync harmony buttons
    document.querySelectorAll('.hbtn').forEach(b => {
      b.classList.toggle('active', b.dataset.harmony === harmony);
    });
    // Update name input
    const ni = document.getElementById('sessionNameInput');
    if (ni) ni.value = sessionName;
    // Restore toggle values from session (always, not just when derivedValues present)
    if (s.bgEffect !== undefined) { varsState.values['--ftr10-bg-effect'] = s.bgEffect; }
    if (s.thpaceEnabled !== undefined) { varsState.values['--ftr10-thpace-enabled'] = s.thpaceEnabled; }
    // Restore extra Vars-panel edits stored on the session. These are a diff vs.
    // the palette-derived set; apply them on top so reopening a card reproduces
    // the user's edits even when the card isn't the active preset.
    if (s.varOverrides) { Object.assign(varsState.values, s.varOverrides); }
    // Update vars panel if derived values provided (active preset path)
    if (msg.derivedValues) {
      // Live (derived) values MUST win over stale session varOverrides, otherwise
      // a re-applied override silently reverts the user's current UI edits.
      varsState.values = { ...(s.varOverrides || {}), ...msg.derivedValues, '--ftr10-bg-effect': s.bgEffect || varsState.values['--ftr10-bg-effect'] || 'nebula', '--ftr10-thpace-enabled': s.thpaceEnabled || varsState.values['--ftr10-thpace-enabled'] || 'true' };
      renderVarsPanel();
    } else if (s.varOverrides) {
      // Card reopened but not the active preset — still render the stored edits
      renderVarsPanel();
    }
    syncBgToggleState(varsState.values);
    renderQuickPanels();
    // Push toggle/var state to extension so effects activate immediately
    vscode.postMessage({ command: 'liveUpdate', values: varsState.values });
    updateUI(false);
  }
  if (msg.command === 'sessionSaved') {
    currentSessionId = msg.sessionId;
    if (msg.name) {
      const ni = document.getElementById('sessionNameInput');
      if (ni) ni.value = msg.name;
    }
  }
  if (msg.command === 'activePresetChanged') {
    activePresetId = msg.activePreset || null;
  }
  if (msg.command === 'varsUpdated') {
    // Sync Architect palette swatches with direct var edits from vars panel
    const rv = msg.values || {};
    const roleVars = ['--ftr10-accent-1','--ftr10-accent-2','--ftr10-accent-3','--ftr10-accent-4','--ftr10-surface-1','--ftr10-surface-2'];
    roleVars.forEach((v, i) => {
      const val = rv[v];
      if (val && /^#[0-9a-fA-F]{6,8}$/.test(val.trim())) {
        overrides[i] = val.trim().slice(0, 7); // store as 6-char hex
      }
    });
    varsState.values = rv;
    syncBgToggleState(rv);
    renderVarsPanel();
    renderQuickPanels();
    updateUI(false);
  }
  if (msg.command === 'architectConfig') {
    if (msg.config) {
      varsState.sections = msg.config.sections || [];
    }
    // Only overwrite values on initial load (no values yet); skip if user has live in-flight edits
    if (!Object.keys(varsState.values).length) {
      varsState.values = msg.values || (msg.config && msg.config.values) || varsState.values;
    }
    if (msg.simpleGroups) varsState.simpleGroups = msg.simpleGroups;
    if (msg.bgImages) __bgImages = msg.bgImages;
    if (msg.activePreset !== undefined) activePresetId = msg.activePreset || null;
    syncBgToggleState(varsState.values);
    renderVarsPanel();
    renderQuickPanels();
    try { syncBgImageGallery(); } catch (e) {
      console.error('syncBgImageGallery failed:', e);
      showPanelError('BG gallery: ' + (e && e.message ? e.message : e));
    }
  }
  if (msg.command === 'syncVars' && msg.values) {
    try {
      for (const [k,v] of Object.entries(msg.values)) {
        varsState.values[k] = v;
      }
      syncBgToggleState(varsState.values);
      renderVarsPanel();
      renderQuickPanels();
      try { syncBgImageGallery(); } catch {}
    } catch (e) { console.error('syncVars failed', e); }
  }
});

// ── request config on load ───────────────────────────────────────────────────
vscode.postMessage({ command: 'getConfig' });

// ── quick panels (Fonts + Opacity) ───────────────────────────────────────────
const QP_FONT_ROWS = [
  { key: '--ftr10-font-activitybar',  label: 'Activity' },
  { key: '--ftr10-font-sidebar',      label: 'Sidebar'  },
  { key: '--ftr10-font-panel-bottom', label: 'Panel Bot'},
  { key: '--ftr10-font-panel-top',    label: 'Panel Top'},
  { key: '--ftr10-font-auxiliarybar', label: 'Aux Bar'  },
];
const QP_OPACITY_ROWS = [
  { key: '--ftr10-opacity-activitybar',  label: 'Activity' },
  { key: '--ftr10-opacity-sidebar',      label: 'Sidebar'  },
  { key: '--ftr10-opacity-panel-bottom', label: 'Panel Bot'},
  { key: '--ftr10-opacity-panel-top',    label: 'Panel Top'},
  { key: '--ftr10-opacity-auxiliarybar', label: 'Aux Bar'  },
];
const QP_FONT_NAMES = ['inherit','Cartograph','DM Mono','Exo 2','Fira Code','JetBrains Mono','Monaspace Krypton','Monaspace Radon','Orbitron','Oxanium','Rajdhani','Recursive','Silkscreen','Space Grotesk','Victor Mono','Victor Mono NF'];

function _qpFontValToName(val) {
  if (!val || val === 'inherit') return 'inherit';
  for (const n of QP_FONT_NAMES) {
    if (val.toLowerCase().includes(n.toLowerCase())) return n;
  }
  return val.split(',')[0].replace(/['"]/g,'').trim();
}

function renderQuickPanels() {
  // Determine if the floating side panels are visible or if we're in stacked mode
  const rlw = document.querySelector('.right-legend-wrap');
  const below = !rlw || getComputedStyle(rlw).display === 'none';
  const tb = document.querySelector('.tables-below');
  if (tb) tb.style.display = below ? 'flex' : 'none';

  let fp = below ? document.getElementById('fontsPanel_below') : document.querySelector('.right-legend-wrap #fontsPanel');
  let op = below ? document.getElementById('opacityPanel_below') : document.querySelector('.right-legend-wrap #opacityPanel');
  const vals = varsState.values;

  if (fp) {
    fp.innerHTML = '<div class="hud-title">Fonts</div>' +
      QP_FONT_ROWS.map(r => {
        const cur = _qpFontValToName(vals[r.key] || '');
        const opts = QP_FONT_NAMES.map(n =>
          '<option value="' + n + '"' + (cur === n ? ' selected' : '') + '>' + n + '</option>'
        ).join('');
        return '<div class="qp-row"><span class="qp-label">' + r.label + '</span><select class="qp-select" data-qpkey="' + r.key + '">' + opts + '</select></div>';
      }).join('');
    fp.querySelectorAll('.qp-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const n = sel.value;
        varsState.values[sel.dataset.qpkey] = n === 'inherit' ? 'inherit' : "'" + n + "', monospace";
        scheduleVarsLiveUpdate();
      });
    });
  }

  if (op) {
    op.innerHTML = '<div class="hud-title">Opacity</div>' +
      QP_OPACITY_ROWS.map(r => {
        const cur = parseFloat(vals[r.key] || '0.4');
        const pct = Math.round(cur * 100);
        const elId = 'qpv_' + r.key.replace(/--ftr10-/,'').replace(/-/g,'_') + (below ? '_b' : '');
        return '<div class="qp-row"><span class="qp-label">' + r.label + '</span>' +
          '<div class="qp-slider-wrap">' +
          '<input type="range" class="qp-slider" min="0" max="1" step="0.05" value="' + cur + '" data-qpkey="' + r.key + '" data-qpvid="' + elId + '">' +
          '<span class="qp-val" id="' + elId + '">' + pct + '%</span>' +
          '</div></div>';
      }).join('');
    op.querySelectorAll('.qp-slider').forEach(sl => {
      const valEl = document.getElementById(sl.dataset.qpvid);
      sl.addEventListener('input', () => {
        if (valEl) valEl.textContent = Math.round(parseFloat(sl.value) * 100) + '%';
      });
      sl.addEventListener('change', () => {
        if (valEl) valEl.textContent = Math.round(parseFloat(sl.value) * 100) + '%';
        varsState.values[sl.dataset.qpkey] = parseFloat(sl.value).toFixed(2);
        scheduleVarsLiveUpdate();
      });
    });
  }
}

// ── bg image gallery ─────────────────────────────────────────────────────
// Renders a picker of available background images. Shown only when the
// selected effect is "image". Selection sets --ftr10-bg-image to a base64
// data: URI (same as the thumbnail) so effects.css paints it INLINE. The
// workbench CSS origin resolves "url(../backgrounds/x)" against the CDN host
// (vscode-cdn.net) which cannot reach the local filesystem
// (ERR_NAME_NOT_RESOLVED) — a data: URI needs no network and always paints.
let __bgImages = [];
function __bgDataUriByName(name) {
  for (const item of __bgImages) { if (item && item.name === name) return item.dataUri || ''; }
  return '';
}
function showPanelError(text) {
  try {
    let el = document.getElementById('ftr10-panel-error');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ftr10-panel-error';
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;max-width:60%;z-index:9999;background:rgba(180,30,30,0.92);color:#fff;font:12px monospace;padding:8px 10px;border-radius:6px;white-space:pre-wrap;box-shadow:0 4px 20px rgba(0,0,0,0.5);';
      document.body.appendChild(el);
    }
    el.textContent = '[FTR10] ' + text;
    el.style.display = 'block';
  } catch (_) {}
}
function setBgImageFromGallery(name) {
  if (name) {
    // Use tiny url("backgrounds/file") instead of 1MB data URI — shim resolves to __base + backgrounds/file
    // Polling vars.json stays small, no lag. Data URIs are still used for webview thumbnails in __bgImages.
    // NOTE: per user spec, background changes must NOT live-update — only Apply persists.
    // So we only update local state + UI, no live relay.
    varsState.values['--ftr10-bg-image'] = 'url("backgrounds/' + name + '")';
    varsState.values['--ftr10-bg-effect'] = 'image';
  } else {
    varsState.values['--ftr10-bg-image'] = 'none';
  }
  syncBgImageGallery();
  // Re-render vars panel to show new value without triggering live persist
  try { renderVarsPanel(); } catch {}
}
function syncBgImageGallery() {
  const currentEffect = (varsState.values['--ftr10-bg-effect'] || 'none').trim().toLowerCase();
  const curImg = (varsState.values['--ftr10-bg-image'] || 'none');
  let activeFile = '';
  if (curImg && curImg !== 'none') {
    const m = curImg.match(/backgrounds\/([^"')]+)/i);
    const curName = m ? m[1] : '';
    if (curName) {
      for (const item of __bgImages) {
        if (item && item.name === curName) { activeFile = item.name; break; }
      }
    } else {
      for (const item of __bgImages) {
        if (item && item.dataUri && curImg.indexOf(item.dataUri) === 0) { activeFile = item.name; break; }
      }
    }
  }
  for (const sfx of ['', '_below']) {
    const host = document.getElementById('bgImgGallery' + sfx);
    if (!host) continue;
    if (currentEffect !== 'image' || __bgImages.length === 0) {
      host.style.display = 'none';
      host.innerHTML = '';
      continue;
    }
    host.style.display = '';
    let html = '';
    for (const item of __bgImages) {
      const name = item && item.name ? item.name : '';
      const dataUri = item && item.dataUri ? item.dataUri : '';
      const sel = name === activeFile ? ' selected' : '';
      html += "<button type='button' class='bg-img-thumb" + sel + "' data-bgimg='" + escapeHtmlA(name) + "' title='" + escapeHtmlA(name) + "'><img src='" + dataUri + "' alt=''></button>";
    }
    host.innerHTML = html;
    host.querySelectorAll('[data-bgimg]').forEach(function (btn) {
      btn.addEventListener('click', function () { setBgImageFromGallery(btn.getAttribute('data-bgimg')); });
    });
  }
}

// ── bg toggles ──────────────────────────────────────────────────────────────
let lastBgEffect = 'nebula';
function syncBgToggleState(values) {
  if (!values) return;
  const current = (values['--ftr10-bg-effect'] || 'none').trim().toLowerCase();
  if (current !== 'none') lastBgEffect = current;
  for (const sfx of ['', '_below']) {
    const thpaceEl = document.getElementById('thpaceToggle' + sfx);
    const effectEl = document.getElementById('bgEffectToggle' + sfx);
    const selectEl = document.getElementById('bgEffectSelect' + sfx);
    if (thpaceEl) thpaceEl.checked = (values['--ftr10-thpace-enabled'] || 'true').trim() !== 'false';
    if (effectEl) effectEl.checked = current !== 'none';
    if (selectEl) selectEl.value = current !== 'none' ? current : lastBgEffect || 'nebula';
  }
  try { syncBgImageGallery(); } catch (e) { console.error('syncBgImageGallery failed:', e); }
}

(function initBgToggles() {
  function wireBgToggles(sfx) {
    const thpaceEl = document.getElementById('thpaceToggle' + sfx);
    const effectEl = document.getElementById('bgEffectToggle' + sfx);
    const selectEl = document.getElementById('bgEffectSelect' + sfx);

    // Inject the image gallery container right after the effect <select> (if not present)
    const selectWrap = selectEl ? selectEl.closest('.qp-select-wrap') : null;
    if (selectWrap && !document.getElementById('bgImgGallery' + sfx)) {
      const gal = document.createElement('div');
      gal.id = 'bgImgGallery' + sfx;
      gal.className = 'bg-img-gallery';
      gal.style.display = 'none';
      selectWrap.parentNode.insertBefore(gal, selectWrap.nextSibling);
    }
    if (thpaceEl) {
      thpaceEl.addEventListener('change', () => {
        varsState.values['--ftr10-thpace-enabled'] = thpaceEl.checked ? 'true' : 'false';
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }

    if (selectEl) {
      selectEl.addEventListener('change', () => {
        const selected = selectEl.value.trim().toLowerCase() || 'none';
        lastBgEffect = selected !== 'none' ? selected : lastBgEffect || 'nebula';
        varsState.values['--ftr10-bg-effect'] = selected;
        // When switching TO image, default to the first available background
        // so the user sees something immediately (they can pick another in the gallery).
        if (selected === 'image' && __bgImages.length && (varsState.values['--ftr10-bg-image'] || 'none') === 'none') {
          setBgImageFromGallery(__bgImages[0]?.name || '');
        }
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }

    if (effectEl) {
      effectEl.addEventListener('change', () => {
        if (effectEl.checked) {
          const current = (varsState.values['--ftr10-bg-effect'] || 'none').trim().toLowerCase();
          varsState.values['--ftr10-bg-effect'] = current === 'none' ? (lastBgEffect || 'nebula') : current;
        } else {
          varsState.values['--ftr10-bg-effect'] = 'none';
        }
        syncBgToggleState(varsState.values);
        scheduleVarsLiveUpdate();
      });
    }
  }
  try {
    wireBgToggles('');
    wireBgToggles('_below');
  } catch (e) { console.error('initBgToggles failed:', e); try { showPanelError('initBgToggles: ' + (e && e.message ? e.message : e)); } catch(_) {} }
})();

window.addEventListener('resize', () => {
  renderQuickPanels();
  syncBgToggleState(varsState.values);
});

// ── floating sparkle particles ────────────────────────────────────────────────
(function initParticles() {
  const pc = document.getElementById('particles');
  const pctx = pc.getContext('2d');
  let pw, ph;
  function resize() {
    pw = pc.width  = window.innerWidth;
    ph = pc.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Bright fallback colors — always visible against dark bg
  const FALLBACK_COLORS = ['#00d4ff','#7c6fff','#ff6ec7','#00ffb8','#ffb800','#ff4d6d'];

  const COUNT = 36;
  const particles = Array.from({length: COUNT}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: Math.random() * 6 + 4,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.25 - 0.1,
    alpha: Math.random() * 0.4 + 0.45,
    da: (Math.random() - 0.5) * 0.003,
    colorIdx: Math.floor(Math.random() * 6),
    twinkle: Math.random() * TWO_PI
  }));

  function drawDiamond(cx, cy, s, col, a) {
    pctx.save();
    pctx.globalAlpha = a;
    pctx.beginPath();
    pctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    pctx.fillStyle = col;
    pctx.shadowColor = col;
    pctx.shadowBlur = s * 5;
    pctx.fill();
    pctx.restore();
  }

  function tick() {
    pctx.clearRect(0, 0, pw, ph);
    particles.forEach(p => {
      p.twinkle += 0.025;
      p.alpha += p.da;
      if (p.alpha > 0.85 || p.alpha < 0.3) p.da *= -1;
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -20) { p.y = ph + 10; p.x = Math.random() * pw; }
      if (p.x < -20) p.x = pw + 10;
      if (p.x > pw + 20) p.x = -10;

      // Use palette's 3 brightest slots (0,1,2) or bright fallbacks if palette not ready
      const palCol = palette.length >= 3 ? palette[p.colorIdx % 3] : null;
      const col = palCol || FALLBACK_COLORS[p.colorIdx % FALLBACK_COLORS.length];
      const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(p.twinkle));
      drawDiamond(p.x, p.y, p.size, col, p.alpha * pulse);
    });
    requestAnimationFrame(tick);
  }
  // particles disabled
  // tick();
})();

// ── init ──────────────────────────────────────────────────────────────────────
updateUI(false);

// expose bridge for picker script
window._codexPalette = palette;
window._codexGenerateHarmony = generateHarmony;
window._codexSetOverride = (idx, hex) => {
  overrides[idx] = hex;
  palette = generateHarmony().map((col, i) => overrides[i] !== undefined ? overrides[i] : col);
  window._codexPalette = palette;
  updateLegend('colorLegendDesktop');
  updateLegend('colorLegendMobile');
  updateUI(false);
};
window._codexClearOverride = (idx) => {
  delete overrides[idx];
  updateUI(false);
  window._codexPalette = palette;
};
})();
</script>

<!-- Color override modal -->
<div class="override-modal-bg" id="overrideModalBg">
  <div class="override-modal">
    <div class="override-modal-title" id="overrideModalTitle">Override Primary</div>
    <div class="override-picker-row">
      <canvas class="sl-canvas" id="slCanvas" width="150" height="150"></canvas>
      <canvas class="hue-strip-canvas" id="hueStripCanvas" width="22" height="150"></canvas>
    </div>
    <div class="override-preview-row">
      <div class="override-preview-swatch" id="overridePreviewSwatch"></div>
      <span class="override-preview-hex" id="overridePreviewHex">#000000</span>
    </div>
    <div class="override-btn-row">
      <button class="override-btn" id="overrideBtnCancel">Cancel</button>
      <button class="override-btn confirm" id="overrideBtnConfirm">✓ Set</button>
    </div>
  </div>
</div>

<script>
(function() {
// ── color override picker ─────────────────────────────────────────────────────
let overrideIdx = -1;
let overrideOriginal = null;
let pickH = 0, pickS = 1, pickV = 1;
let slDragging = false, hueDragging = false;

const slCv = document.getElementById('slCanvas');
const slCtx2 = slCv.getContext('2d');
const hueCv = document.getElementById('hueStripCanvas');
const hueCtx2 = hueCv.getContext('2d');
const SW = slCv.width, SH = slCv.height;
const HW = hueCv.width, HH = hueCv.height;

function hsv2hex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return '#' + [r + m, g + m, b + m].map(n => Math.round(n * 255).toString(16).padStart(2, '0')).join('');
}

function hex2hsv(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)      h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else                h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function drawSLCanvas() {
  slCtx2.fillStyle = \`hsl(\${pickH},100%,50%)\`;
  slCtx2.fillRect(0, 0, SW, SH);
  const wg = slCtx2.createLinearGradient(0, 0, SW, 0);
  wg.addColorStop(0, 'rgba(255,255,255,1)');
  wg.addColorStop(1, 'rgba(255,255,255,0)');
  slCtx2.fillStyle = wg;
  slCtx2.fillRect(0, 0, SW, SH);
  const bg = slCtx2.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,1)');
  slCtx2.fillStyle = bg;
  slCtx2.fillRect(0, 0, SW, SH);
  const cx = pickS * SW, cy = (1 - pickV) * SH;
  slCtx2.beginPath();
  slCtx2.arc(cx, cy, 6, 0, Math.PI * 2);
  slCtx2.strokeStyle = 'rgba(255,255,255,0.92)';
  slCtx2.lineWidth = 2;
  slCtx2.stroke();
  slCtx2.beginPath();
  slCtx2.arc(cx, cy, 4, 0, Math.PI * 2);
  slCtx2.strokeStyle = 'rgba(0,0,0,0.5)';
  slCtx2.lineWidth = 1;
  slCtx2.stroke();
}

function drawHueStrip() {
  const grad = hueCtx2.createLinearGradient(0, 0, 0, HH);
  for (let i = 0; i <= 12; i++) grad.addColorStop(i / 12, \`hsl(\${i * 30},100%,50%)\`);
  hueCtx2.fillStyle = grad;
  hueCtx2.fillRect(0, 0, HW, HH);
  const y = (pickH / 360) * HH;
  hueCtx2.strokeStyle = 'rgba(255,255,255,0.9)';
  hueCtx2.lineWidth = 2;
  hueCtx2.beginPath();
  hueCtx2.moveTo(0, y);
  hueCtx2.lineTo(HW, y);
  hueCtx2.stroke();
}

function drawPicker() {
  drawSLCanvas();
  drawHueStrip();
  const hex = hsv2hex(pickH, pickS, pickV);
  document.getElementById('overridePreviewSwatch').style.background = hex;
  document.getElementById('overridePreviewHex').textContent = hex.toUpperCase();
  [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.background = hex; el.style.setProperty('--glow', hex + '88'); }
  });
}

function openOverrideModal(idx) {
  overrideIdx = idx;
  overrideOriginal = (window._codexPalette || [])[idx] || '#888888';
  const roleNames = ['Primary','Accent','Support','Contrast','Surface','Depth'];
  document.getElementById('overrideModalTitle').textContent = \`Override \${roleNames[idx] || 'Color ' + (idx + 1)}\`;
  const { h, s, v } = hex2hsv(overrideOriginal);
  pickH = h; pickS = s; pickV = v;
  document.getElementById('overrideModalBg').classList.add('open');
  drawPicker();
}

function closeOverrideModal(confirm) {
  document.getElementById('overrideModalBg').classList.remove('open');
  if (!confirm) {
    [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.background = overrideOriginal; el.style.setProperty('--glow', overrideOriginal + '88'); }
    });
  }
  overrideIdx = -1;
}

function handleSL(e) {
  const rect = slCv.getBoundingClientRect();
  const scaleX = SW / rect.width, scaleY = SH / rect.height;
  const cx = (e.clientX !== undefined ? e.clientX : e.touches[0].clientX) - rect.left;
  const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY) - rect.top;
  pickS = Math.max(0, Math.min(1, cx * scaleX / SW));
  pickV = Math.max(0, Math.min(1, 1 - (cy * scaleY / SH)));
  drawPicker();
}

function handleHue(e) {
  const rect = hueCv.getBoundingClientRect();
  const scaleY = HH / rect.height;
  const cy = (e.clientY !== undefined ? e.clientY : e.touches[0].clientY) - rect.top;
  pickH = Math.max(0, Math.min(359.9, (cy * scaleY / HH) * 360));
  drawPicker();
}

slCv.addEventListener('mousedown', e => { slDragging = true; handleSL(e); });
slCv.addEventListener('mousemove', e => { if (slDragging) handleSL(e); });
slCv.addEventListener('touchstart', e => { e.preventDefault(); slDragging = true; handleSL(e); }, { passive: false });
slCv.addEventListener('touchmove', e => { e.preventDefault(); if (slDragging) handleSL(e); }, { passive: false });
slCv.addEventListener('touchend', () => { slDragging = false; });
hueCv.addEventListener('mousedown', e => { hueDragging = true; handleHue(e); });
hueCv.addEventListener('mousemove', e => { if (hueDragging) handleHue(e); });
hueCv.addEventListener('touchstart', e => { e.preventDefault(); hueDragging = true; handleHue(e); }, { passive: false });
hueCv.addEventListener('touchmove', e => { e.preventDefault(); if (hueDragging) handleHue(e); }, { passive: false });
hueCv.addEventListener('touchend', () => { hueDragging = false; });
window.addEventListener('mouseup', () => { slDragging = false; hueDragging = false; });

document.getElementById('overrideBtnConfirm').addEventListener('click', () => {
  const hex = hsv2hex(pickH, pickS, pickV);
  if (window._codexSetOverride) window._codexSetOverride(overrideIdx, hex);
  [\`lp\${overrideIdx}\`, \`rp\${overrideIdx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('has-override');
  });
  closeOverrideModal(true);
});

document.getElementById('overrideBtnCancel').addEventListener('click', () => closeOverrideModal(false));

function clearOverride(idx) {
  if (window._codexClearOverride) window._codexClearOverride(idx);
  [\`lp\${idx}\`, \`rp\${idx}\`].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('has-override');
  });
}

document.getElementById('overrideModalBg').addEventListener('click', e => {
  if (e.target === document.getElementById('overrideModalBg')) closeOverrideModal(false);
});

['leftPanel', 'rightPanel'].forEach(panelId => {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.addEventListener('click', e => {
    // X badge click = clear override
    const xbadge = e.target.closest('.ps-override-x');
    if (xbadge) {
      e.stopPropagation();
      const ps = xbadge.closest('.ps');
      if (!ps) return;
      const prefix = panelId === 'leftPanel' ? 'lp' : 'rp';
      const idx = parseInt(ps.id.replace(prefix, ''));
      if (!isNaN(idx)) clearOverride(idx);
      return;
    }
    // normal click = open picker
    const ps = e.target.closest('.ps');
    if (!ps) return;
    const prefix = panelId === 'leftPanel' ? 'lp' : 'rp';
    const idx = parseInt(ps.id.replace(prefix, ''));
    if (!isNaN(idx)) openOverrideModal(idx);
  });
});

window._codexOpenOverride = openOverrideModal;
})();
</script>
<script>
(function(){
  // Per-point state: current offset, target offset, velocity (for lerp)
  var state = null; // {offsets: Float32Array, targets: Float32Array}
  var PAD = 20;          // canvas overflow px so outward spikes aren't clipped
  var LERP = 0.18;       // how fast offsets chase their target (lower = smoother)
  var SPIKE_CHANCE = 0.018; // per-point per-frame chance of picking a new large target
  var MAX_JITTER = 12;   // max perpendicular displacement in px

  // jolt system — occasionally ramp up speed for a burst of frames
  var joltFrames = 0;
  var JOLT_CHANCE = 0.004;  // per-frame chance of a jolt starting (~once every ~4s)
  var JOLT_LERP = 0.65;     // lerp speed during jolt
  var JOLT_SPIKE = 0.12;    // spike chance during jolt
  var JOLT_DURATION = 10;   // frames the jolt lasts

  function roundedRectPts(x, y, w, h, r) {
    var pts = [];
    var arcSteps = Math.max(4, Math.round(r * Math.PI / 2 / 7));
    function addEdge(x1,y1,x2,y2) {
      var len = Math.hypot(x2-x1, y2-y1);
      var steps = Math.max(2, Math.round(len / 7));
      var nx = (y2-y1)/len, ny = -(x2-x1)/len;
      for (var i = 0; i < steps; i++) {
        var t = i/steps;
        pts.push({x: x1+t*(x2-x1), y: y1+t*(y2-y1), nx: nx, ny: ny});
      }
    }
    function addArc(cx,cy,a0,a1) {
      for (var i = 0; i < arcSteps; i++) {
        var a = a0 + (a1-a0)*i/arcSteps;
        pts.push({x: cx+r*Math.cos(a), y: cy+r*Math.sin(a), nx: Math.cos(a), ny: Math.sin(a)});
      }
    }
    addEdge(x+r, y, x+w-r, y);
    addArc(x+w-r, y+r, -Math.PI/2, 0);
    addEdge(x+w, y+r, x+w, y+h-r);
    addArc(x+w-r, y+h-r, 0, Math.PI/2);
    addEdge(x+w-r, y+h, x+r, y+h);
    addArc(x+r, y+h-r, Math.PI/2, Math.PI);
    addEdge(x, y+h-r, x, y+r);
    addArc(x+r, y+r, Math.PI, Math.PI*1.5);
    return pts;
  }

  function ensureState(n) {
    if (state && state.offsets.length === n) return;
    state = {
      offsets: new Float32Array(n),
      targets: new Float32Array(n)
    };
    for (var i = 0; i < n; i++) {
      state.targets[i] = (Math.random() - 0.5) * MAX_JITTER * 2;
    }
  }

  function stepState() {
    // maybe trigger a jolt
    if (joltFrames <= 0 && Math.random() < JOLT_CHANCE) joltFrames = JOLT_DURATION;
    var lerp = joltFrames > 0 ? JOLT_LERP : LERP;
    var spike = joltFrames > 0 ? JOLT_SPIKE : SPIKE_CHANCE;
    if (joltFrames > 0) joltFrames--;

    var o = state.offsets, t = state.targets;
    for (var i = 0; i < o.length; i++) {
      // occasionally snap to a new random target (electric spike)
      if (Math.random() < spike) {
        t[i] = (Math.random() - 0.5) * MAX_JITTER * 2;
      }
      // smoothly lerp offset toward target
      o[i] += (t[i] - o[i]) * lerp;
      // once close to target, relax target back toward zero
      if (Math.abs(t[i] - o[i]) < 0.5) {
        t[i] = (Math.random() - 0.5) * 4; // rest near zero with tiny noise
      }
    }
  }

  function drawBorder(cv, pts, accentHex) {
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);

    var o = state.offsets;

    // outer glow pass
    ctx.save();
    ctx.shadowColor = accentHex;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + pts[0].nx * o[0], pts[0].y + pts[0].ny * o[0]);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + pts[i].nx * o[i], pts[i].y + pts[i].ny * o[i]);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // inner bright core — tighter offsets
    ctx.save();
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(pts[0].x + pts[0].nx * o[0] * 0.35, pts[0].y + pts[0].ny * o[0] * 0.35);
    for (var i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + pts[i].nx * o[i] * 0.35, pts[i].y + pts[i].ny * o[i] * 0.35);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function getAccent() {
    return getComputedStyle(document.documentElement).getPropertyValue('--ui-accent').trim() || '#00e5ff';
  }

  var canvases = Array.from(document.querySelectorAll('.ep-canvas'));
  var pts = null;
  var lastW = 0, lastH = 0;

  function tick() {
    var cv0 = canvases[0];
    if (cv0) {
      var p = cv0.parentElement;
      var W = p.offsetWidth, H = p.offsetHeight;
      if (W !== lastW || H !== lastH) {
        lastW = W; lastH = H;
        canvases.forEach(function(cv) { cv.width = W + PAD*2; cv.height = H + PAD*2; });
        pts = roundedRectPts(PAD + 3, PAD + 3, W - 6, H - 6, 18);
        ensureState(pts.length);
      }
    }
    if (pts && pts.length) {
      stepState();
      var accent = getAccent();
      canvases.forEach(function(cv) {
        if (cv.width > 0 && cv.height > 0) drawBorder(cv, pts, accent);
      });
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>
`;
}

function getEditorHtml(cfg: ThemeConfig): string {
  const cssContent = buildWebviewVarsCss(cfg);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>FTR10 Theme Editor</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style id="ftr10-theme-css">${cssContent}</style>
  <style>
    :root {
      --v-bg: var(--vscode-editor-background, #0b0f14);
      --v-fg: var(--vscode-editor-foreground, #e6edf3);
      --v-muted: var(--vscode-descriptionForeground, #8b949e);
      --v-border: var(--vscode-panel-border, #ffffff1a);
      --v-input-bg: #ffffff0f;
      --v-input-fg: var(--vscode-input-foreground, var(--v-fg));
      --v-btn: var(--ftr10-accent-1, var(--vscode-button-background, #7c3aed));
      --v-btn-fg: var(--vscode-button-foreground, white);
      --v-focus: var(--ftr10-accent-1, var(--vscode-focusBorder, #c084fc));
      --v-accent: var(--ftr10-accent-1, #7c3aed);
      --v-accent-glow: color-mix(in srgb, var(--v-accent) 35%, transparent);
      --v-accent-tint: color-mix(in srgb, var(--v-accent) 8%, transparent);
      --v-accent-tint-hover: color-mix(in srgb, var(--v-accent) 14%, transparent);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; margin: 0; }
    html { background: transparent !important; }
    body {
      font-family: var(--ftr10-body-font, monospace);
      background: transparent !important;
      color: var(--ftr10-text, var(--v-fg));
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Toolbar ── */
    .toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      background: #ffffff05;
      flex-shrink: 0;
      position: relative;
      border-bottom: 1px solid #ffffff0f;
    }
    .toolbar::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, var(--v-accent) 0%, transparent 60%);
      opacity: 0.6;
    }
    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .toolbar-logo {
      width: 22px; height: 22px;
      border-radius: 6px;
      background: var(--v-accent-tint);
      border: 1px solid var(--v-accent-glow);
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
    .toolbar-logo svg { display: block; }
    .toolbar-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .toolbar h1 {
      font-size: 13px;
      font-weight: 700;
      margin: 0;
      letter-spacing: 0.04em;
      background: linear-gradient(90deg, var(--v-fg) 0%, var(--v-accent) 120%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .preset-pill {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 20px;
      background: var(--v-accent-tint);
      border: 1px solid var(--v-accent-glow);
      color: var(--v-accent);
      white-space: nowrap;
    }

    /* Toggle switch */
    .toggle-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--v-muted);
      cursor: pointer;
      user-select: none;
    }
    .toggle-track {
      width: 32px;
      height: 18px;
      border-radius: 9px;
      background: #ffffff14;
      border: 1px solid #ffffff1a;
      position: relative;
      transition: background 0.2s, border-color 0.2s;
    }
    .toggle-track.on {
      background: var(--v-accent-tint);
      border-color: var(--v-accent-glow);
    }
    .toggle-thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--v-muted);
      transition: left 0.2s, background 0.2s;
    }
    .toggle-track.on .toggle-thumb {
      left: 16px;
      background: var(--v-accent);
    }

    /* Buttons */
    button { appearance: none; border: none; cursor: pointer; font: inherit; }
    .btn {
      padding: 7px 14px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      background: var(--v-accent);
      color: white;
      border: none;
      box-shadow: 0 0 12px var(--v-accent-glow);
      transition: box-shadow 0.2s, opacity 0.2s;
    }
    .btn:hover { opacity: 0.88; box-shadow: 0 0 20px var(--v-accent-glow); }
    .btn-ghost {
      padding: 7px 14px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 500;
      background: transparent;
      color: var(--v-muted);
      border: 1px solid #ffffff1a;
      transition: border-color 0.15s, color 0.15s;
    }
    .btn-ghost:hover { border-color: var(--v-accent-glow); color: var(--v-accent); }

    /* ── Content area ── */
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 18px;
      scrollbar-width: thin !important;
      scrollbar-color: #ffffff2e transparent;
    }
    .content::-webkit-scrollbar { width: 4px !important; }
    .content::-webkit-scrollbar-track { background: transparent; }
    .content::-webkit-scrollbar-thumb { background: #ffffff26; border-radius: 2px; }
    .content::-webkit-scrollbar-thumb:hover { background: #ffffff47; }

    /* ── Group cards ── */
    .group { margin-bottom: 20px; }
    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 7px 10px;
      border-radius: 8px;
      cursor: pointer;
      user-select: none;
      background: #ffffff05;
      border: 1px solid #ffffff0d;
      transition: background 0.15s, border-color 0.15s;
    }
    .group-header:hover {
      background: var(--v-accent-tint);
      border-color: var(--v-accent-glow);
    }
    .group-header-bar {
      width: 3px;
      height: 14px;
      border-radius: 2px;
      background: var(--v-accent);
      flex-shrink: 0;
      opacity: 0.7;
    }
    .group-header h2 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--v-fg);
      margin: 0;
      flex: 1;
    }
    .group-header .count {
      font-size: 10px;
      font-family: var(--ftr10-code-font, monospace);
      color: var(--v-accent);
      opacity: 0.7;
      background: var(--v-accent-tint);
      padding: 1px 6px;
      border-radius: 10px;
    }
    .group-header .chevron {
      font-size: 10px;
      color: var(--v-muted);
      transition: transform 0.2s;
      opacity: 0.6;
    }
    .group.collapsed .chevron { transform: rotate(-90deg); }
    .group.collapsed .group-fields { display: none; }

    .group-fields { display: grid; gap: 4px; }

    /* ── Field row ── */
    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      padding: 8px 10px 8px 14px;
      border-radius: 7px;
      background: #ffffff05;
      border: 1px solid #ffffff12;
      align-items: center;
      position: relative;
      transition: background 0.15s, border-color 0.15s;
      overflow: hidden;
    }
    .field-row::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 2px;
      background: var(--v-accent);
      opacity: 0;
      transition: opacity 0.15s;
    }
    .field-row:hover {
      background: var(--v-accent-tint);
      border-color: color-mix(in srgb, var(--v-accent) 20%, transparent);
    }
    .field-row:hover::before { opacity: 0.7; }
    .field-label {
      font-family: var(--ftr10-code-font, monospace);
      font-size: 10.5px;
      color: var(--v-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.01em;
    }
    .field-row:hover .field-label { color: var(--v-fg); }
    .field-input-wrap {
      display: flex;
      gap: 5px;
      align-items: center;
    }
    .field-input-wrap input[type="text"],
    .field-input-wrap select {
      flex: 1;
      padding: 5px 8px;
      border-radius: 5px;
      border: 1px solid #ffffff14;
      background: rgba(10, 4, 20, 0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: var(--v-input-fg);
      font-family: var(--ftr10-code-font, monospace);
      font-size: 11px;
      outline: none;
      min-width: 0;
      transition: border-color 0.15s;
    }
    .field-input-wrap input[type="text"]:focus,
    .field-input-wrap select:focus { border-color: var(--v-focus); }
    .field-input-wrap .select-wrap {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .field-input-wrap .select-wrap select {
      flex: 1;
      width: 100%;
      padding-right: 28px;
    }
    .field-input-wrap .select-wrap::after {
      content: '▾';
      position: absolute;
      right: 9px;
      pointer-events: none;
      color: var(--v-input-fg);
      font-size: 13px;
      opacity: 0.7;
      line-height: 1;
    }
    .field-input-wrap select {
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }
    select option {
      background: #1a0d2e;
      color: var(--v-input-fg);
      backdrop-filter: blur(12px);
    }
    .field-input-wrap input[type="color"] {
      width: 26px;
      height: 26px;
      border: 1px solid #ffffff1f;
      border-radius: 5px;
      padding: 1px;
      cursor: pointer;
      background: transparent;
      flex-shrink: 0;
    }
    .alpha-wrap {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .alpha-wrap input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      width: 48px;
      height: 5px;
      border-radius: 3px;
      background: linear-gradient(to right, transparent, var(--swatch-color, #fff));
      outline: none;
      cursor: pointer;
    }
    .alpha-wrap input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: white;
      border: 2px solid #0000004c;
      box-shadow: 0 1px 3px #00000066;
    }
    .alpha-label {
      font-family: var(--ftr10-code-font, monospace);
      font-size: 10px;
      color: var(--v-muted);
      min-width: 26px;
      text-align: right;
    }

    /* ── Custom CSS area ── */
    .custom-css-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #ffffff0f;
    }
    .custom-css-section h2 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--v-muted);
      margin: 0 0 8px 0;
    }
    .custom-css-section textarea {
      width: 100%;
      min-height: 110px;
      padding: 10px 12px;
      border-radius: 7px;
      border: 1px solid #ffffff14;
      background: #00000033;
      color: var(--v-input-fg);
      font-family: var(--ftr10-code-font, monospace);
      font-size: 11px;
      resize: vertical;
      outline: none;
      transition: border-color 0.15s;
    }
    .custom-css-section textarea:focus { border-color: var(--v-focus); }

    /* ── Status bar ── */
    .statusbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 18px;
      font-size: 10.5px;
      color: var(--v-muted);
      border-top: 1px solid #ffffff0d;
      background: #00000026;
      flex-shrink: 0;
      gap: 8px;
    }
    .statusbar-left { display: flex; align-items: center; gap: 6px; }
    .status-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--v-accent);
      box-shadow: 0 0 6px var(--v-accent-glow);
      flex-shrink: 0;
    }
    .statusbar-right {
      font-family: var(--ftr10-code-font, monospace);
      font-size: 10px;
      color: var(--v-accent);
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="toolbar-logo">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1L11 6L6 11L1 6Z" fill="none" stroke="var(--v-accent)" stroke-width="1.5" stroke-linejoin="round"/>
          <circle cx="6" cy="6" r="1.5" fill="var(--v-accent)"/>
        </svg>
      </div>
      <div class="toolbar-title-wrap">
        <h1>FTR10 Theme Editor</h1>
      </div>
      <span class="preset-pill" id="presetLabel"></span>
    </div>
    <div class="toolbar-right">
      <div class="toggle-wrap" id="advancedToggle">
        <span>Advanced</span>
        <div class="toggle-track" id="toggleTrack">
          <div class="toggle-thumb"></div>
        </div>
      </div>
      <button class="btn-ghost" id="resetBtn">Reset</button>
      <button class="btn-ghost" id="bgModeBtn" style="display:none" title="Toggle background mode">✦ Effects</button>
      <button class="btn" id="applyBtn">Apply & Sync</button>
    </div>
  </div>

  <div class="content" id="content"></div>

  <div class="statusbar">
    <div class="statusbar-left">
      <div class="status-dot"></div>
      <span id="statusText">Ready</span>
    </div>
    <span class="statusbar-right" id="statusVars">0 variables</span>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    let state = {
      sections: [],
      values: {},
      cssImports: [],
      customCss: '',
      activePreset: '',
      advanced: false,
      simpleGroups: [],
      presets: [],
      bgModeMap: {}
    };

    // Auto-save debounce — fires 2 s after the last variable edit
    let _liveTimer = null;
    function scheduleLiveUpdate() {
      clearTimeout(_liveTimer);
      _liveTimer = setTimeout(function() {
        _liveTimer = null;
        vscode.postMessage({
          command: 'liveUpdate',
          sections: state.sections,
          values: state.values,
          cssImports: state.cssImports,
          customCss: document.getElementById('customCss')?.value || state.customCss,
          activePreset: state.activePreset
        });
      }, 2000);
    }

    const content = document.getElementById('content');
    const toggleTrack = document.getElementById('toggleTrack');
    const presetLabel = document.getElementById('presetLabel');

    function escapeHtml(s) {
      return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
    }

    function isHexColor(v) {
      return /^#[0-9a-f]{6,8}$/i.test((v || '').trim());
    }

    function toPickerHex(v) {
      const h = (v || '').trim();
      return h.length >= 7 ? h.slice(0, 7) : '#000000';
    }

    function hexAlpha(v) {
      const h = (v || '').trim();
      if (h.length === 9) {
        return Math.round(parseInt(h.slice(7, 9), 16) / 255 * 100);
      }
      return 100;
    }

    function alphaToHex(pct) {
      const val = Math.round(pct / 100 * 255);
      return val.toString(16).padStart(2, '0');
    }

    const FONT_OPTIONS = ["inherit",'Cartograph','DM Mono','Exo 2','Fira Code','JetBrains Mono','Monaspace Krypton','Monaspace Radon','Orbitron','Oxanium','Rajdhani','Recursive','Silkscreen','Space Grotesk','Victor Mono','Victor Mono NF'];
    const SELECT_OPTIONS = {
      '--ftr10-bg-effect': ['none', 'image', 'kaleidoscope', 'aurora', 'nebula', 'crt', 'circuit', 'meshflow', 'playstation'],
      '--ftr10-body-font': FONT_OPTIONS,
      '--ftr10-heading-font': FONT_OPTIONS,
      '--ftr10-code-font': FONT_OPTIONS,
      '--ftr10-font-activitybar': FONT_OPTIONS,
      '--ftr10-font-sidebar': FONT_OPTIONS,
      '--ftr10-font-panel-bottom': FONT_OPTIONS,
      '--ftr10-font-panel-top': FONT_OPTIONS,
      '--ftr10-font-auxiliarybar': FONT_OPTIONS
    };

    function buildFieldRow(key, value) {
      const opts = SELECT_OPTIONS[key];
      let html = '<div class="field-row">';
      html += '<div class="field-label" title="' + escapeHtml(key) + '">' + escapeHtml(key) + '</div>';
      html += '<div class="field-input-wrap">';
      if (opts) {
        html += '<div class="select-wrap"><select data-key="' + escapeHtml(key) + '" data-role="select">';
        opts.forEach(o => { html += '<option value="' + escapeHtml(o) + '"' + (o === value ? ' selected' : '') + '>' + escapeHtml(o) + '</option>'; });
        html += '</select></div>';
      } else {
        const showPicker = isHexColor(value);
        const alpha = showPicker ? hexAlpha(value) : 100;
        if (showPicker) {
          html += '<input type="color" data-key="' + escapeHtml(key) + '" data-role="picker" value="' + escapeHtml(toPickerHex(value)) + '"/>';
          html += '<div class="alpha-wrap" style="--swatch-color:' + escapeHtml(toPickerHex(value)) + '">';
          html += '<input type="range" min="0" max="100" value="' + alpha + '" data-key="' + escapeHtml(key) + '" data-role="alpha"/>';
          html += '<span class="alpha-label" data-key="' + escapeHtml(key) + '" data-role="alpha-label">' + alpha + '%</span>';
          html += '</div>';
        }
        html += '<input type="text" data-key="' + escapeHtml(key) + '" data-role="text" value="' + escapeHtml(value) + '" placeholder="CSS value"/>';
      }
      html += '</div></div>';
      return html;
    }

    function renderSimple() {
      let html = '';
      state.simpleGroups.forEach(group => {
        const keys = group.keys.filter(k => k in state.values);
        if (keys.length === 0) return;
        html += '<div class="group">';
        html += '<div class="group-header"><div class="group-header-bar"></div><h2>' + escapeHtml(group.label) + '</h2><span class="count">' + keys.length + '</span><span class="chevron">&#9662;</span></div>';
        html += '<div class="group-fields">';
        keys.forEach(k => { html += buildFieldRow(k, state.values[k]); });
        html += '</div></div>';
      });
      html += renderCustomCss();
      return html;
    }

    function renderAdvanced() {
      let html = '';
      state.sections.forEach(section => {
        html += '<div class="group">';
        html += '<div class="group-header"><div class="group-header-bar"></div><h2>' + escapeHtml(section.name) + '</h2><span class="count">' + section.keys.length + '</span><span class="chevron">&#9662;</span></div>';
        html += '<div class="group-fields">';
        section.keys.forEach(k => { html += buildFieldRow(k, state.values[k] || ''); });
        html += '</div></div>';
      });
      html += renderCustomCss();
      return html;
    }

    function renderCustomCss() {
      return '<div class="custom-css-section">' +
        '<h2>Custom CSS</h2>' +
        '<textarea id="customCss" placeholder="Optional custom CSS appended after generated variables...">' + escapeHtml(state.customCss || '') + '</textarea>' +
        '</div>';
    }

    function render() {
      content.innerHTML = state.advanced ? renderAdvanced() : renderSimple();
      wireInputs();
      wireGroupHeaders();
      wireCustomCss();
      syncMeta();
    }

    function syncFieldControls(key, newValue) {
      state.values[key] = newValue;
      const ek = CSS.escape(key);
      const picker = content.querySelector('input[data-role="picker"][data-key="' + ek + '"]');
      const slider = content.querySelector('input[data-role="alpha"][data-key="' + ek + '"]');
      const label = content.querySelector('[data-role="alpha-label"][data-key="' + ek + '"]');
      const text = content.querySelector('input[data-role="text"][data-key="' + ek + '"]');
      const alphaWrap = slider?.parentElement;
      if (picker && isHexColor(newValue)) {
        picker.value = toPickerHex(newValue);
      }
      if (slider) {
        const a = hexAlpha(newValue);
        slider.value = a;
        if (label) label.textContent = a + '%';
        if (alphaWrap) alphaWrap.style.setProperty('--swatch-color', toPickerHex(newValue));
      }
      if (text && text !== document.activeElement) {
        text.value = newValue;
      }
      syncMeta();
      scheduleLiveUpdate();
    }

    function wireInputs() {
      content.querySelectorAll('input[data-role="text"]').forEach(input => {
        input.addEventListener('input', e => {
          const key = e.target.getAttribute('data-key');
          syncFieldControls(key, e.target.value);
        });
      });
      content.querySelectorAll('input[data-role="picker"]').forEach(input => {
        input.addEventListener('input', e => {
          const key = e.target.getAttribute('data-key');
          const prev = state.values[key] || '';
          const alpha = prev.length === 9 ? prev.slice(7) : '';
          syncFieldControls(key, e.target.value + alpha);
        });
      });
      content.querySelectorAll('input[data-role="alpha"]').forEach(input => {
        input.addEventListener('input', e => {
          const key = e.target.getAttribute('data-key');
          const base = toPickerHex(state.values[key] || '#000000');
          const pct = parseInt(e.target.value, 10);
          const hex = pct >= 100 ? '' : alphaToHex(pct);
          syncFieldControls(key, base + hex);
        });
      });
      content.querySelectorAll('select[data-role="select"]').forEach(sel => {
        sel.addEventListener('change', e => {
          const key = e.target.getAttribute('data-key');
          syncFieldControls(key, e.target.value);
        });
      });
    }

    function wireGroupHeaders() {
      content.querySelectorAll('.group-header').forEach(header => {
        header.addEventListener('click', () => {
          header.parentElement.classList.toggle('collapsed');
        });
      });
    }

    function wireCustomCss() {
      const ta = document.getElementById('customCss');
      if (ta) {
        ta.addEventListener('input', e => {
          state.customCss = e.target.value;
          syncMeta();
          scheduleLiveUpdate();
        });
      }
    }

    function syncMeta() {
      const preset = state.presets.find(p => p.id === state.activePreset);
      presetLabel.textContent = preset ? preset.name : 'Custom';
      document.getElementById('statusVars').textContent = Object.keys(state.values).length + ' variables';
      document.getElementById('statusText').textContent = state.advanced ? 'Advanced mode' : 'Simple mode';
    }

    // Toggle
    document.getElementById('advancedToggle').addEventListener('click', () => {
      state.advanced = !state.advanced;
      toggleTrack.classList.toggle('on', state.advanced);
      render();
    });

    // Apply
    document.getElementById('applyBtn').addEventListener('click', () => {
      // Cancel any pending auto-save — this is an explicit immediate save
      clearTimeout(_liveTimer);
      _liveTimer = null;
      state.customCss = document.getElementById('customCss')?.value || state.customCss;
      vscode.postMessage({
        command: 'apply',
        sections: state.sections,
        values: state.values,
        cssImports: state.cssImports,
        customCss: state.customCss,
        activePreset: state.activePreset
      });
    });

    // Reset
    document.getElementById('resetBtn').addEventListener('click', () => {
      vscode.postMessage({ command: 'reset' });
    });

    // Bg-mode toggle
    const bgModeBtn = document.getElementById('bgModeBtn');
    bgModeBtn.addEventListener('click', () => {
      if (state.activePreset) {
        vscode.postMessage({ command: 'toggleBackgroundMode', presetId: state.activePreset });
      }
    });

    function syncBgModeBtn() {
      if (!state.activePreset) { bgModeBtn.style.display = 'none'; return; }
      const mode = state.bgModeMap[state.activePreset] || 'effects';
      bgModeBtn.style.display = '';
      bgModeBtn.textContent = mode === 'effects' ? '✦ Effects' : '▣ Solid';
      bgModeBtn.title = mode === 'effects'
        ? 'Background: Thpace + transparent — click to switch to solid'
        : 'Background: solid preset bg — click to switch to effects';
      bgModeBtn.style.borderColor = mode === 'effects' ? 'color-mix(in srgb, var(--v-accent) 50%, transparent)' : '';
      bgModeBtn.style.color = mode === 'effects' ? 'var(--v-accent)' : '';
    }

    // Receive config
    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'sync' && msg.config) {
        state.sections = msg.config.sections || [];
        state.values = msg.config.values || {};
        state.cssImports = msg.config.cssImports || [];
        state.customCss = msg.config.customCss || '';
        state.activePreset = msg.config.activePreset || '';
        if (msg.simpleGroups) state.simpleGroups = msg.simpleGroups;
        if (msg.presets) state.presets = msg.presets;
        if (msg.bgModeMap) state.bgModeMap = msg.bgModeMap;
        // Rewrite CSS vars style element so editor UI chrome reflects new theme
        if (msg.config.values) {
          var css = ':root {\\n' + Object.entries(msg.config.values).map(function(kv) { return '  ' + kv[0] + ': ' + kv[1] + ';'; }).join('\\n') + '\\n}';
          if (msg.config.customCss) css += '\\n' + msg.config.customCss + '\\n';
          var styleEl = document.getElementById('ftr10-theme-css');
          if (styleEl) styleEl.textContent = css;
        }
        syncBgModeBtn();
        render();
      }
      if (msg.command === 'syncBgMode' && msg.bgModeMap) {
        state.bgModeMap = msg.bgModeMap;
        if (msg.activePreset !== undefined) state.activePreset = msg.activePreset;
        syncBgModeBtn();
      }
      if (msg.command === 'relayVars' && msg.cssVars) {
        try { new BroadcastChannel('theme-sync').postMessage({ cssVars: msg.cssVars }); } catch(_) {}
      }
    });

    // Initial load
    vscode.postMessage({ command: 'getConfig' });

    // Ghost scrollbar — remove sb-visible toggle, scrollbar is always visible
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
