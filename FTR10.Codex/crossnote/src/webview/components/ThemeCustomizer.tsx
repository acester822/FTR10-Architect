/**
 * ThemeCustomizer v3 — slide-in right panel for customizing preview theme colors.
 *
 * Theming is driven entirely by ~/.ftr10/css_files/colors.css (the FTR10 source of
 * truth).  This panel reads the current CSS custom-property values on mount and lets
 * users adjust them; changes are written to style.less via the writeUserStyle
 * postMessage, so the extension picks them up and refreshes all open previews.
 *
 * Preset system removed — all defaults live in colors.css.
 */

import { XMarkIcon, SwatchIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import PreviewContainer from '../containers/preview';

// ── Seed Color → Token Derivation ─────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  l = Math.max(0, Math.min(100, l));
  const hN = h / 360, sN = s / 100, lN = l / 100;
  const q = lN < 0.5 ? lN * (1 + sN) : lN + sN - lN * sN;
  const p = 2 * lN - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(hue2rgb(hN + 1/3))}${toHex(hue2rgb(hN))}${toHex(hue2rgb(hN - 1/3))}`;
}

function shiftHex(hex: string, dH: number, dL: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return hex;
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h + dH, s, l + dL);
}

function hexToRgba(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || hex.length !== 7) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function deriveTokens(a1: string, a2: string, a3: string): Record<string, string> {
  return {
    '--ftr10-token-keyword':  shiftHex(a1, 0,   15),
    '--ftr10-token-string':   shiftHex(a2, 10,  8),
    '--ftr10-token-function': shiftHex(a1, 20,  10),
    '--ftr10-token-number':   a3,
    '--ftr10-token-operator': shiftHex(a2, -15, 12),
    '--ftr10-token-property': shiftHex(a2, 30,  5),
    '--ftr10-token-tag':      shiftHex(a3, 15,  0),
    '--ftr10-token-selector': shiftHex(a1, -20, 5),
    '--ftr10-token-comment':  'rgba(255,255,255,0.30)',
  };
}

// ── Font Options ─────────────────────────────────────────────────────────────

const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Theme Default',  value: '' },
  { label: 'Victor Mono',    value: "'Victor Mono', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'Fira Code',      value: "'Fira Code', monospace" },
  { label: 'DM Mono',        value: "'DM Mono', monospace" },
  { label: 'Recursive',      value: "'Recursive', monospace" },
  { label: 'Silkscreen',     value: "'Silkscreen', monospace" },
  { label: 'Orbitron',       value: "'Orbitron', sans-serif" },
  { label: 'Oxanium',        value: "'Oxanium', sans-serif" },
  { label: 'Exo 2',          value: "'Exo 2', sans-serif" },
  { label: 'Rajdhani',       value: "'Rajdhani', sans-serif" },
  { label: 'Space Grotesk',  value: "'Space Grotesk', sans-serif" },
  { label: 'System UI',      value: 'system-ui, sans-serif' },
  { label: 'Monospace',      value: 'monospace' },
  { label: 'Serif',          value: 'Georgia, serif' },
];

// ── Background Patterns ───────────────────────────────────────────────────────

interface BgPattern {
  id: string;
  label: string;
  css: string;
  size: string;
  pos?: string;
}

function makeBgPatterns(accent: string): BgPattern[] {
  const c13 = hexToRgba(accent, 0.13);
  const c08 = hexToRgba(accent, 0.08);
  const c05 = hexToRgba(accent, 0.05);
  const c03 = hexToRgba(accent, 0.03);
  return [
    { id: 'none',      label: 'None',      css: 'none',                                                                                                                                                                                                                                                   size: 'auto'                                   },
    { id: 'dots',      label: 'Dots',      css: `radial-gradient(circle, ${c13} 1px, transparent 1px)`,                                                                                                                                                                                                    size: '20px 20px'                              },
    { id: 'grid',      label: 'Grid',      css: `linear-gradient(${c08} 1px, transparent 1px), linear-gradient(90deg, ${c08} 1px, transparent 1px)`,                                                                                                                                                        size: '30px 30px'                              },
    { id: 'mesh',      label: 'Mesh',      css: `linear-gradient(${c05} 1px, transparent 1px), linear-gradient(90deg, ${c05} 1px, transparent 1px), radial-gradient(ellipse at 50% 50%, ${c03} 0%, transparent 60%)`,                                                                                        size: '40px 40px'                              },
    { id: 'scanlines', label: 'Scanlines', css: `repeating-linear-gradient(0deg, transparent, transparent 2px, ${c03} 2px, ${c03} 3px)`,                                                                                                                                                                    size: '100% 4px'                               },
    { id: 'diagonal',  label: 'Diagonal',  css: `repeating-linear-gradient(45deg, transparent, transparent 8px, ${c05} 8px, ${c05} 9px)`,                                                                                                                                                                  size: '100% 100%'                              },
    { id: 'crosses',   label: 'Crosses',   css: `radial-gradient(circle, ${c08} 2px, transparent 2px), radial-gradient(circle, ${c05} 1px, transparent 1px)`,                                                                                                                                               size: '18px 18px, 9px 9px',  pos: '0 0, 9px 9px'  },
    { id: 'circuit',   label: 'Circuit',   css: `linear-gradient(${c08} 1px, transparent 1px), linear-gradient(90deg, ${c08} 1px, transparent 1px), radial-gradient(${c13} 1.5px, transparent 1.5px)`,                                                                                                      size: '40px 40px, 40px 40px, 20px 20px', pos: '0 0, 0 0, 10px 10px' },
    { id: 'hex',       label: 'Hexagons',  css: `linear-gradient(30deg, ${c05} 12%, transparent 12.5%, transparent 87%, ${c05} 87.5%), linear-gradient(150deg, ${c05} 12%, transparent 12.5%, transparent 87%, ${c05} 87.5%), linear-gradient(60deg, ${c08} 25%, transparent 25.5%, transparent 75%, ${c08} 75%)`,  size: '80px 140px',          pos: '0 0'           },
    { id: 'noise',     label: 'Noise',     css: `radial-gradient(${c05} 1px, transparent 0), radial-gradient(${c03} 1px, transparent 0)`,                                                                                                                                                                   size: '8px 8px, 4px 4px',   pos: '0 0, 2px 2px'  },
  ];
}

// ── Hover Effect Presets ──────────────────────────────────────────────────────

const HOVER_PRESETS: Record<string, Record<string, string>> = {
  plain:  { '--ftr10-link-hover-shadow': 'none',                                                                   '--ftr10-link-hover-transform': 'none'              },
  glow:   { '--ftr10-link-hover-shadow': '0 0 10px currentColor, 0 0 20px currentColor',                           '--ftr10-link-hover-transform': 'none'              },
  lift:   { '--ftr10-link-hover-shadow': 'none',                                                                   '--ftr10-link-hover-transform': 'translateY(-2px)'  },
  pop:    { '--ftr10-link-hover-shadow': '0 0 8px currentColor',                                                   '--ftr10-link-hover-transform': 'translateY(-2px)'  },
};

// ── CSS Block Builder ─────────────────────────────────────────────────────────

function buildCSSBlock(
  vars: Record<string, string>,
  tokens: Record<string, string>,
  bgCss: string,
  bgSize: string,
  bgPos: string,
  kaleidoscope: boolean = false,
): string {
  const a1 = vars['--ftr10-accent-1'] ?? '#00b4d8';
  const a2 = vars['--ftr10-accent-2'] ?? '#7c3aed';
  const a3 = vars['--ftr10-accent-3'] ?? '#f43f5e';
  const allVars: Record<string, string> = {
    ...vars,
    ...tokens,
    '--ftr10-hr-gradient':     `linear-gradient(90deg, transparent, ${a1}, ${a2}, ${a3}, transparent)`,
    '--ftr10-bg-pattern':      bgCss,
    '--ftr10-bg-pattern-size': bgSize,
    '--ftr10-bg-pattern-pos':  bgPos,
    '--ftr10-kaleidoscope':    kaleidoscope ? 'on' : 'none',
  };
  if (!('--ftr10-code-border-l'     in vars)) allVars['--ftr10-code-border-l']     = a1;
  if (!('--ftr10-code-border-r'     in vars)) allVars['--ftr10-code-border-r']     = a2;
  if (!('--ftr10-blockquote-border' in vars)) allVars['--ftr10-blockquote-border'] = a1;
  const lines = Object.entries(allVars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  return `:root {\n${lines}\n}\n`;
}

function assembleStyleFile(block: string): string {
  return `/* === MPAE Theme Generator: start === */\n${block}/* === MPAE Theme Generator: end === */\n`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ColorRowProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorRow({ label, value, onChange }: ColorRowProps) {
  const [hexInput, setHexInput] = useState(value);
  useEffect(() => { setHexInput(value); }, [value]);

  const safeHex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#808080';

  return (
    <div className="flex items-center gap-2 py-1.5">
      <label className="text-xs w-24 shrink-0 opacity-60">{label}</label>
      <input
        type="color"
        value={safeHex}
        onChange={(e) => { setHexInput(e.target.value); onChange(e.target.value); }}
        className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent flex-shrink-0"
        style={{ WebkitAppearance: 'none', appearance: 'none' }}
      />
      <input
        type="text"
        value={hexInput}
        onChange={(e) => {
          setHexInput(e.target.value);
          if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
        }}
        maxLength={7}
        className="bg-transparent border border-white/10 rounded px-2 py-0.5 text-xs font-mono w-24 focus:outline-none focus:border-white/30 text-white/70"
        placeholder="#rrggbb"
        spellCheck={false}
      />
    </div>
  );
}

// Extracts the human-readable first family name from a font-family stack
function firstFontName(stack: string): string {
  const first = stack.split(',')[0].replace(/['"/]/g, '').trim();
  return first || 'Victor Mono';
}

interface FontRowProps {
  label: string;
  value: string;
  themeFont: string;
  onChange: (v: string) => void;
}

function FontRow({ label, value, themeFont, onChange }: FontRowProps) {
  const defaultLabel = `Theme (${firstFontName(themeFont)})`;
  const options = [
    { label: defaultLabel, value: '' },
    ...FONT_OPTIONS.slice(1),
  ];
  return (
    <div className="flex items-center gap-2 py-1.5">
      <label className="text-xs w-16 shrink-0 opacity-60">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded px-2 py-1 text-xs focus:outline-none focus:border-white/30 text-white/70 border border-white/10"
        style={{ background: 'rgba(20,20,32,0.95)' }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#14141f' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: string) => void;
}

function SliderRow({ label, value, min, max, step = 1, unit = 'px', onChange }: SliderRowProps) {
  const parsed = parseFloat(value) || 0;
  const display = step < 1 ? parsed.toFixed(1) : String(Math.round(parsed));
  return (
    <div className="flex items-center gap-2 py-1">
      <label className="text-xs w-24 shrink-0 opacity-60">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={parsed}
        onChange={(e) => onChange(e.target.value + unit)}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: 'var(--ftr10-accent-1, #00b4d8)' }}
      />
      <span className="text-[10px] font-mono w-10 text-right opacity-45">{display}{unit}</span>
    </div>
  );
}

interface SelectRowProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}

function SelectRow({ label, value, options, onChange }: SelectRowProps) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <label className="text-xs w-24 shrink-0 opacity-60">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded px-2 py-1 text-xs focus:outline-none focus:border-white/30 text-white/70 border border-white/10"
        style={{ background: 'rgba(20,20,32,0.95)' }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} style={{ background: '#14141f' }}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ThemeCustomizerProps {
  show: boolean;
  onClose: () => void;
}

export default function ThemeCustomizer({ show, onClose }: ThemeCustomizerProps) {
  const { postMessage, kaleidoscope, toggleKaleidoscope } = PreviewContainer.useContainer();

  const [vars, setVars]     = useState<Record<string, string>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [bgPatternId, setBgPatternId]   = useState<string>('none');
  const [showBgEffects, setShowBgEffects] = useState(false);
  const [hoverEffect, setHoverEffect]   = useState<string>('plain');
  const [showTokens, setShowTokens]     = useState(false);
  const [showColors, setShowColors]     = useState(true);
  const [showFonts, setShowFonts]       = useState(false);
  const [showStyle, setShowStyle]       = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [clearIndicator, setClearIndicator] = useState(false);
  const [fontOverrides, setFontOverrides] = useState({ heading: '', body: '', code: '' });
  const fontOverridesRef = useRef<{ heading: string; body: string; code: string }>({ heading: '', body: '', code: '' });
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestWriteParamsRef = useRef<{
    vars: Record<string, string>;
    tokens: Record<string, string>;
    bgPatternId: string;
    hoverEffect: string;
    fontOverrides: { heading: string; body: string; code: string };
  }>({
    vars: {},
    tokens: {},
    bgPatternId: 'none',
    hoverEffect: 'plain',
    fontOverrides: { heading: '', body: '', code: '' },
  });

  const bgPatterns = makeBgPatterns(vars['--ftr10-accent-1'] ?? '#00b4d8');

  // Keep fontOverridesRef in sync so stale callbacks can always read the latest value
  useEffect(() => { fontOverridesRef.current = fontOverrides; }, [fontOverrides]);

  // ── Init vars from computed CSS on mount ────────────────────────────────────
  useEffect(() => {
    const cs = getComputedStyle(document.documentElement);
    const rv = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    const initVars: Record<string, string> = {
      '--ftr10-accent-1':         rv('--ftr10-accent-1',         '#00b4d8'),
      '--ftr10-accent-2':         rv('--ftr10-accent-2',         '#7c3aed'),
      '--ftr10-accent-3':         rv('--ftr10-accent-3',         '#f43f5e'),
      '--ftr10-bg':               rv('--ftr10-bg',               '#121212'),
      '--ftr10-text':             rv('--ftr10-text',             'rgba(255,255,255,0.87)'),
      '--ftr10-text-muted':       rv('--ftr10-text-muted',       'rgba(255,255,255,0.45)'),
      '--ftr10-border':           rv('--ftr10-border',           'rgba(255,255,255,0.10)'),
      '--ftr10-surface':          rv('--ftr10-surface',          'rgba(255,255,255,0.04)'),
      '--ftr10-strong-color':     rv('--ftr10-strong-color',     '#ffffff'),
      '--ftr10-em-color':         rv('--ftr10-em-color',         '#00b4d8'),
      '--ftr10-mark-color':       rv('--ftr10-mark-color',       '#7c3aed'),
      '--ftr10-mark-bg':          rv('--ftr10-mark-bg',          'rgba(124,58,237,0.14)'),
      '--ftr10-radius-block':     rv('--ftr10-radius-block',     '14px'),
      '--ftr10-radius-quote':     rv('--ftr10-radius-quote',     '12px'),
      '--ftr10-radius-inline':    rv('--ftr10-radius-inline',    '6px'),
      '--ftr10-radius-img':       rv('--ftr10-radius-img',       '12px'),
      '--ftr10-heading-transform':rv('--ftr10-heading-transform','none'),
      '--ftr10-heading-spacing':  rv('--ftr10-heading-spacing',  '0px'),
      '--ftr10-heading-font':     rv('--ftr10-heading-font',     "'Victor Mono', monospace"),
      '--ftr10-body-font':        rv('--ftr10-body-font',        "'Victor Mono', monospace"),
      '--ftr10-code-font':        rv('--ftr10-code-font',        "'Victor Mono', monospace"),
      '--ftr10-link-style':       rv('--ftr10-link-style',       'solid'),
      '--ftr10-surface-hover':    rv('--ftr10-surface-hover',    'rgba(255,255,255,0.04)'),
      '--ftr10-blockquote-width': rv('--ftr10-blockquote-width', '3px'),
      '--ftr10-border-style':     rv('--ftr10-border-style',     'solid'),
    };
    const initTokens: Record<string, string> = {
      '--ftr10-token-keyword':  rv('--ftr10-token-keyword',  '#7c3aed'),
      '--ftr10-token-string':   rv('--ftr10-token-string',   '#00b4d8'),
      '--ftr10-token-function': rv('--ftr10-token-function', '#7c3aed'),
      '--ftr10-token-number':   rv('--ftr10-token-number',   '#f43f5e'),
      '--ftr10-token-operator': rv('--ftr10-token-operator', '#00b4d8'),
      '--ftr10-token-property': rv('--ftr10-token-property', '#00b4d8'),
      '--ftr10-token-tag':      rv('--ftr10-token-tag',      '#f43f5e'),
      '--ftr10-token-selector': rv('--ftr10-token-selector', '#7c3aed'),
      '--ftr10-token-comment':  rv('--ftr10-token-comment',  'rgba(255,255,255,0.30)'),
    };
    setVars(initVars);
    setTokens(initTokens);
    latestWriteParamsRef.current.vars   = initVars;
    latestWriteParamsRef.current.tokens = initTokens;
  }, []);

  // ── Restore bg-pattern and hover-effect from localStorage on mount ──────────
  useEffect(() => {
    try {
      const bgId = localStorage.getItem('mpae-bg-pattern') ?? 'none';
      setBgPatternId(bgId);
      latestWriteParamsRef.current.bgPatternId = bgId;
    } catch { /* private browsing */ }
    try {
      const hvId = localStorage.getItem('mpae-hover-effect') ?? 'plain';
      setHoverEffect(hvId);
      latestWriteParamsRef.current.hoverEffect = hvId;
      const hv = HOVER_PRESETS[hvId] ?? HOVER_PRESETS.plain;
      Object.entries(hv).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    } catch { /* private browsing */ }
  }, []);

  // ── Auto-write style.less on any user change (debounced 800 ms) ─────────────
  const scheduleAutoWrite = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const { vars: v, tokens: t, bgPatternId: bgId, hoverEffect: hv, fontOverrides: fo } = latestWriteParamsRef.current;
      const pats = makeBgPatterns(v['--ftr10-accent-1'] ?? '#00b4d8');
      const pat  = pats.find((p) => p.id === bgId);
      const fontVarOverrides: Record<string, string> = {};
      if (fo.heading) fontVarOverrides['--ftr10-heading-font'] = fo.heading;
      if (fo.body)    fontVarOverrides['--ftr10-body-font']    = fo.body;
      if (fo.code)    fontVarOverrides['--ftr10-code-font']    = fo.code;
      const block = buildCSSBlock(
        { ...v, ...fontVarOverrides, ...(HOVER_PRESETS[hv] ?? HOVER_PRESETS.plain) },
        t,
        pat?.css ?? 'none', pat?.size ?? 'auto', pat?.pos ?? '0 0',
        kaleidoscope,
      );
      postMessage('writeUserStyle', [assembleStyleFile(block)]);
    }, 800);
  }, [kaleidoscope, postMessage]);

  // ── Live-update a single core var ──────────────────────────────────────────
  const updateVar = useCallback((key: string, value: string) => {
    setVars((prev) => {
      const next = { ...prev, [key]: value };
      const a1 = key === '--ftr10-accent-1' ? value : (next['--ftr10-accent-1'] ?? '');
      const a2 = key === '--ftr10-accent-2' ? value : (next['--ftr10-accent-2'] ?? '');
      const a3 = key === '--ftr10-accent-3' ? value : (next['--ftr10-accent-3'] ?? '');
      let newTokens = tokens;
      if (/^#[0-9a-fA-F]{6}$/.test(a1) && /^#[0-9a-fA-F]{6}$/.test(a2) && /^#[0-9a-fA-F]{6}$/.test(a3)) {
        newTokens = deriveTokens(a1, a2, a3);
        setTokens(newTokens);
      }
      latestWriteParamsRef.current = { ...latestWriteParamsRef.current, vars: next, tokens: newTokens };
      return next;
    });
    scheduleAutoWrite();
  }, [tokens, scheduleAutoWrite]);

  // ── Live-update a single token var ─────────────────────────────────────────
  const updateToken = useCallback((key: string, value: string) => {
    setTokens((prev) => {
      const next = { ...prev, [key]: value };
      latestWriteParamsRef.current = { ...latestWriteParamsRef.current, tokens: next };
      return next;
    });
    scheduleAutoWrite();
  }, [scheduleAutoWrite]);

  // ── Apply font override live ────────────────────────────────────────────────
  const applyFontOverride = useCallback((key: 'heading' | 'body' | 'code', value: string) => {
    setFontOverrides((prev) => ({ ...prev, [key]: value }));
    const cssVar = key === 'heading' ? '--ftr10-heading-font'
                 : key === 'body'    ? '--ftr10-body-font'
                 :                    '--ftr10-code-font';
    if (value) {
      document.documentElement.style.setProperty(cssVar, value);
    } else {
      document.documentElement.style.removeProperty(cssVar);
    }
    latestWriteParamsRef.current = { ...latestWriteParamsRef.current, fontOverrides: { ...fontOverridesRef.current, [key]: value } };
    scheduleAutoWrite();
  }, [scheduleAutoWrite]);

  // ── Apply background pattern live ──────────────────────────────────────────
  const applyBgPattern = useCallback((id: string) => {
    setBgPatternId(id);
    try { localStorage.setItem('mpae-bg-pattern', id); } catch { /* private browsing */ }
    const pat = bgPatterns.find((p) => p.id === id);
    if (pat) {
      document.documentElement.style.setProperty('--ftr10-bg-pattern', pat.css);
      document.documentElement.style.setProperty('--ftr10-bg-pattern-size', pat.size);
      document.documentElement.style.setProperty('--ftr10-bg-pattern-pos', pat.pos ?? '0 0');
    }
    latestWriteParamsRef.current = { ...latestWriteParamsRef.current, bgPatternId: id };
    scheduleAutoWrite();
  }, [bgPatterns, scheduleAutoWrite]);

  // ── Apply hover effect preset ──────────────────────────────────────────────────
  const applyHoverEffect = useCallback((key: string) => {
    setHoverEffect(key);
    try { localStorage.setItem('mpae-hover-effect', key); } catch { /* private browsing */ }
    const hv = HOVER_PRESETS[key] ?? HOVER_PRESETS.plain;
    Object.entries(hv).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    latestWriteParamsRef.current = { ...latestWriteParamsRef.current, hoverEffect: key };
    scheduleAutoWrite();
  }, [scheduleAutoWrite]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const pat = bgPatterns.find((p) => p.id === bgPatternId);
    const fontVarOverrides: Record<string, string> = {};
    if (fontOverrides.heading) fontVarOverrides['--ftr10-heading-font'] = fontOverrides.heading;
    if (fontOverrides.body)    fontVarOverrides['--ftr10-body-font']    = fontOverrides.body;
    if (fontOverrides.code)    fontVarOverrides['--ftr10-code-font']    = fontOverrides.code;
    const block = buildCSSBlock(
      { ...vars, ...fontVarOverrides, ...(HOVER_PRESETS[hoverEffect] ?? HOVER_PRESETS.plain) },
      tokens,
      pat?.css ?? 'none',
      pat?.size ?? 'auto',
      pat?.pos ?? '0 0',
      kaleidoscope,
    );
    postMessage('writeUserStyle', [assembleStyleFile(block)]);
    setSavedIndicator(true);
    setTimeout(() => setSavedIndicator(false), 2000);
  }, [vars, tokens, bgPatternId, bgPatterns, fontOverrides, hoverEffect, postMessage, kaleidoscope]);

  // ── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    try {
      localStorage.removeItem('mpae-theme-blocks');
      localStorage.removeItem('mpae-bg-pattern');
      localStorage.removeItem('mpae-hover-effect');
      postMessage('writeUserStyle', ['']);
    } catch {
      postMessage('writeUserStyle', ['']);
    }
    localStorage.removeItem('mpae-kaleidoscope');
    document.documentElement.removeAttribute('data-mpae-kaleidoscope');
    setClearIndicator(true);
    setTimeout(() => setClearIndicator(false), 2000);
  }, [postMessage]);

  // ── Panel style ─────────────────────────────────────────────────────────────
  const a1 = vars['--ftr10-accent-1'] ?? '#00b4d8';
  const a2 = vars['--ftr10-accent-2'] ?? '#7c3aed';

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, right: 0,
    height: '100vh', width: '280px',
    zIndex: 9999,
    background: 'rgba(10, 10, 16, 0.96)',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    borderLeft: `1px solid ${a1}22`,
    boxShadow: `-4px 0 40px rgba(0,0,0,0.6), -1px 0 0 ${a1}18`,
    display: 'flex', flexDirection: 'column',
    transform: show ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: show ? 'all' : 'none',
    fontFamily: 'var(--vscode-font-family, "Victor Mono", monospace)',
    overflowY: 'auto',
  };

  return (
    <div style={panelStyle} className="select-none">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${a1}18`, background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="flex items-center gap-2">
          <SwatchIcon className="w-4 h-4" style={{ color: a1 }} />
          <span className="text-sm font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Theme Customizer
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 transition-colors" title="Close">
          <XMarkIcon className="w-4 h-4 opacity-50 hover:opacity-80" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ minHeight: 0 }}>

        {/* Seed Colors */}
        <div className="flex items-center mt-4 mb-2">
          <button
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity flex-1 text-left"
            onClick={() => setShowColors((x) => !x)}
          >
            <span>Colors</span>
            <span className="ml-1">{showColors
              ? <ChevronUpIcon className="w-3 h-3 inline" />
              : <ChevronDownIcon className="w-3 h-3 inline" />
            }</span>
          </button>
        </div>
        {showColors && (
          <>
            <p className="text-[9px] opacity-30 mb-2 leading-tight">
              Accent colors auto-derive all syntax tokens.
            </p>
            <ColorRow
              label="Primary"
              value={vars['--ftr10-accent-1'] ?? '#00b4d8'}
              onChange={(v) => updateVar('--ftr10-accent-1', v)}
            />
            <ColorRow
              label="Secondary"
              value={vars['--ftr10-accent-2'] ?? '#7c3aed'}
              onChange={(v) => updateVar('--ftr10-accent-2', v)}
            />
            <ColorRow
              label="Tertiary"
              value={vars['--ftr10-accent-3'] ?? '#f43f5e'}
              onChange={(v) => updateVar('--ftr10-accent-3', v)}
            />
            <ColorRow
              label="Background"
              value={vars['--ftr10-bg'] ?? '#121212'}
              onChange={(v) => updateVar('--ftr10-bg', v)}
            />
          </>
        )}

        {/* Tokens (advanced disclosure) */}
        <button
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity mt-4 mb-2 w-full text-left"
          onClick={() => setShowTokens((x) => !x)}
        >
          <span>Syntax Tokens</span>
          <span className="ml-auto">{showTokens
            ? <ChevronUpIcon className="w-3 h-3 inline" />
            : <ChevronDownIcon className="w-3 h-3 inline" />
          }</span>
        </button>
        {showTokens && (
          <div>
            {([
              ['Keyword',  '--ftr10-token-keyword'],
              ['String',   '--ftr10-token-string'],
              ['Function', '--ftr10-token-function'],
              ['Number',   '--ftr10-token-number'],
              ['Operator', '--ftr10-token-operator'],
              ['Property', '--ftr10-token-property'],
              ['Tag',      '--ftr10-token-tag'],
              ['Selector', '--ftr10-token-selector'],
            ] as [string, string][]).map(([label, key]) => (
              <ColorRow
                key={key}
                label={label}
                value={tokens[key] ?? '#ffffff'}
                onChange={(v) => updateToken(key, v)}
              />
            ))}
          </div>
        )}

        {/* Fonts */}
        <button
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity mt-4 mb-2 w-full text-left"
          onClick={() => setShowFonts((x) => !x)}
        >
          <span>Fonts</span>
          <span className="ml-auto">{showFonts
            ? <ChevronUpIcon className="w-3 h-3 inline" />
            : <ChevronDownIcon className="w-3 h-3 inline" />
          }</span>
        </button>
        {showFonts && (
          <>
            <p className="text-[9px] opacity-30 mb-2 leading-tight">
              Override the font selections.
            </p>
            <FontRow label="Headers" value={fontOverrides.heading} themeFont={vars['--ftr10-heading-font'] ?? "'Victor Mono', monospace"} onChange={(v) => applyFontOverride('heading', v)} />
            <FontRow label="Body"    value={fontOverrides.body}    themeFont={vars['--ftr10-body-font']    ?? "'Victor Mono', monospace"} onChange={(v) => applyFontOverride('body', v)} />
            <FontRow label="Code"    value={fontOverrides.code}    themeFont={vars['--ftr10-code-font']    ?? "'Victor Mono', monospace"} onChange={(v) => applyFontOverride('code', v)} />
          </>
        )}

        {/* Shape & Style */}
        <button
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity mt-4 mb-2 w-full text-left"
          onClick={() => setShowStyle((x) => !x)}
        >
          <span>Shape &amp; Style</span>
          <span className="ml-auto">{showStyle
            ? <ChevronUpIcon className="w-3 h-3 inline" />
            : <ChevronDownIcon className="w-3 h-3 inline" />
          }</span>
        </button>
        {showStyle && (
          <>
            <p className="text-[9px] opacity-30 mb-3 leading-tight">
              Border radii, heading case, emphasis colours, link underline.
            </p>

            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-30 mb-1.5">Radii</div>
            <SliderRow label="Code blocks" value={vars['--ftr10-radius-block'] ?? '14px'} min={0} max={28} onChange={(v) => updateVar('--ftr10-radius-block', v)} />
            <SliderRow label="Blockquotes" value={vars['--ftr10-radius-quote'] ?? '12px'} min={0} max={24} onChange={(v) => updateVar('--ftr10-radius-quote', v)} />
            <SliderRow label="Inline code" value={vars['--ftr10-radius-inline'] ?? '6px'}  min={0} max={16} onChange={(v) => updateVar('--ftr10-radius-inline', v)} />
            <SliderRow label="Images"      value={vars['--ftr10-radius-img'] ?? '12px'}   min={0} max={32} onChange={(v) => updateVar('--ftr10-radius-img', v)} />

            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-30 mb-1.5 mt-3">Headings</div>
            <SelectRow
              label="Case"
              value={vars['--ftr10-heading-transform'] ?? 'none'}
              options={[
                { label: 'Normal', value: 'none' },
                { label: 'UPPERCASE', value: 'uppercase' },
                { label: 'Capitalize', value: 'capitalize' },
              ]}
              onChange={(v) => updateVar('--ftr10-heading-transform', v)}
            />
            <SliderRow label="Letter space" value={vars['--ftr10-heading-spacing'] ?? '0.5px'} min={0} max={5} step={0.5} onChange={(v) => updateVar('--ftr10-heading-spacing', v)} />

            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-30 mb-1.5 mt-3">Emphasis</div>
            <ColorRow label="Bold"   value={vars['--ftr10-strong-color'] ?? '#ffffff'}        onChange={(v) => updateVar('--ftr10-strong-color', v)} />
            <ColorRow label="Italic" value={vars['--ftr10-em-color'] ?? '#00b4d8'}            onChange={(v) => updateVar('--ftr10-em-color', v)} />
            <ColorRow label="Mark"   value={vars['--ftr10-mark-color'] ?? '#7c3aed'}          onChange={(v) => updateVar('--ftr10-mark-color', v)} />

            <div className="text-[9px] font-semibold uppercase tracking-wider opacity-30 mb-1.5 mt-3">Links &amp; Quotes</div>
            <SelectRow
              label="Link style"
              value={vars['--ftr10-link-style'] ?? 'solid'}
              options={[
                { label: 'Solid', value: 'solid' },
                { label: 'Dashed', value: 'dashed' },
                { label: 'Dotted', value: 'dotted' },
                { label: 'None', value: 'none' },
              ]}
              onChange={(v) => updateVar('--ftr10-link-style', v)}
            />
            <SelectRow
              label="Border style"
              value={vars['--ftr10-border-style'] ?? 'solid'}
              options={[
                { label: 'Solid', value: 'solid' },
                { label: 'Dashed', value: 'dashed' },
                { label: 'Dotted', value: 'dotted' },
                { label: 'Double', value: 'double' },
              ]}
              onChange={(v) => updateVar('--ftr10-border-style', v)}
            />
            <SelectRow
              label="Hover FX"
              value={hoverEffect}
              options={[
                { label: 'Plain', value: 'plain' },
                { label: 'Glow',  value: 'glow'  },
                { label: 'Lift',  value: 'lift'  },
                { label: 'Pop',   value: 'pop'   },
              ]}
              onChange={applyHoverEffect}
            />
            <SliderRow label="Quote border" value={vars['--ftr10-blockquote-width'] ?? '3px'} min={1} max={8} onChange={(v) => updateVar('--ftr10-blockquote-width', v)} />
          </>
        )}

        {/* Background Pattern */}
        <button
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest opacity-40 hover:opacity-70 transition-opacity mt-4 mb-2 w-full text-left"
          onClick={() => setShowBgEffects((x) => !x)}
        >
          <span>Extra Background Effects</span>
          <span className="ml-auto">{showBgEffects
            ? <ChevronUpIcon className="w-3 h-3 inline" />
            : <ChevronDownIcon className="w-3 h-3 inline" />
          }</span>
        </button>
        {showBgEffects && (
        <>
        <div className="grid grid-cols-3 gap-1.5">
          {bgPatterns.map((pat) => (
            <button
              key={pat.id}
              onClick={() => applyBgPattern(pat.id)}
              className={classNames(
                'px-2 py-1.5 rounded text-[10px] font-medium border transition-all duration-150',
                bgPatternId === pat.id
                  ? 'border-white/35 text-white/85 bg-white/8'
                  : 'border-white/8 text-white/40 hover:border-white/20 hover:text-white/65 bg-transparent',
              )}
            >
              {pat.label}
            </button>
          ))}
        </div>

        {/* Kaleidoscope Toggle */}
        <div className="flex items-center justify-between py-2 mt-3 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-60">
            Kaleidoscope
          </span>
          <button
            onClick={toggleKaleidoscope}
            className={classNames(
              'relative w-10 h-5 rounded-full transition-all duration-200 border',
              kaleidoscope
                ? 'border-white/30'
                : 'border-white/15 bg-white/5',
            )}
            style={kaleidoscope ? { background: `${a1}35`, borderColor: `${a1}50` } : {}}
          >
            <span
              className={classNames(
                'absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-200',
                kaleidoscope ? 'translate-x-5' : 'translate-x-0',
              )}
              style={{ background: kaleidoscope ? a1 : 'rgba(255,255,255,0.35)' }}
            />
          </button>
        </div>
        </>
        )}
      </div>

      {/* Footer */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${a1}18`, background: 'rgba(255,255,255,0.01)' }}
      >
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{
              background: savedIndicator
                ? 'rgba(86,171,47,0.25)'
                : `linear-gradient(135deg, ${a1}33, ${a2}33)`,
              border: `1px solid ${savedIndicator ? 'rgba(86,171,47,0.5)' : `${a1}40`}`,
              color: savedIndicator ? '#7ee787' : 'rgba(255,255,255,0.85)',
            }}
          >
            {savedIndicator ? '✓ Saved' : 'Save'}
          </button>
          <button
            onClick={handleClear}
            className="flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:brightness-110 active:scale-95"
            style={{
              background: clearIndicator ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${clearIndicator ? 'rgba(244,63,94,0.40)' : 'rgba(255,255,255,0.10)'}`,
              color: clearIndicator ? '#f87171' : 'rgba(255,255,255,0.55)',
            }}
          >
            {clearIndicator ? '✓ Cleared' : 'Clear'}
          </button>
        </div>
        <p className="text-center text-[9px] opacity-25 mt-1.5 leading-tight">
          Writes to ~/.ftr10/style.less
        </p>
      </div>
    </div>
  );
}
