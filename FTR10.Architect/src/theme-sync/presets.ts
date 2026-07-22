import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemePreset, ArchitectSession } from './types';
import { SIMPLE_GROUPS, THEME_PRESETS, DEFAULT_VALUES } from './constants';
import * as state from './state';

function hexToHue(hex: string): number {
  try {
    const h = hex.replace('#','').trim();
    if (h.length < 6) return 0;
    const r = parseInt(h.slice(0,2),16)/255;
    const g = parseInt(h.slice(2,4),16)/255;
    const b = parseInt(h.slice(4,6),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    if (max === min) return 0;
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
  if (!hexOrCss) return '#000000';
  const s = hexOrCss.trim();
  // #RRGGBBAA → #RRGGBB
  if (/^#[0-9a-fA-F]{8}$/.test(s)) return s.slice(0,7);
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  // try to extract hex from color-mix / other
  const m = s.match(/#[0-9a-fA-F]{6,8}/);
  if (m) return m[0].slice(0,7);
  return '#000000';
}
export function presetToBaseSession(preset: ThemePreset): ArchitectSession {
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
    if (max === rn) h = 60*(((gn-bn)/d)%6);
    else if (max === gn) h = 60*(((bn-rn)/d)+2);
    else h = 60*(((rn-gn)/d)+4);
    if (h < 0) h += 360;
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

export function computeSessionVarDiff(session: ArchitectSession, liveValues: Record<string, string>): Record<string, string> {
  const derived = deriveCodexPreset(session).overrides;
  const diff: Record<string, string> = {};
  for (const [key, val] of Object.entries(liveValues || {})) {
    if (typeof val !== 'string') continue;
    if (key.startsWith('--ftr10-') && derived[key] !== val) {
      diff[key] = val;
    }
  }
  return diff;
}
