import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemeConfig, Section, RawThemeJson } from './types';
import { SIMPLE_GROUPS, THEME_PRESETS, DEFAULT_VALUES } from './constants';
import { sourceP10kInTerminals } from './css';
import { persistThemeConfig } from './activation';
import * as state from './state';
import { isPanelAlive } from './state';

export function migrateConfig(): void {
  const canonical = flattenConfig(buildDefaultConfig());

  // 1. Add any missing values from DEFAULT_VALUES
  // Only fill if the key is strictly absent (undefined) — empty string is a valid intentional value
  let valuesChanged = false;
  for (const [key, defaultVal] of Object.entries(canonical.values)) {
    if (state.store.themeConfig.values[key] === undefined) {
      state.store.themeConfig.values[key] = defaultVal;
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
    const current = state.store.themeConfig.values[token];
    if (typeof current === 'string') {
      const normalized = current.trim().toLowerCase();
      for (const [legacyValue, replacement] of Object.entries(mapping)) {
        if (normalized === legacyValue.toLowerCase()) {
          state.store.themeConfig.values[token] = replacement;
          valuesChanged = true;
        }
      }
    }
  }

  // 2. Sync section key arrays — add missing keys, preserve order, keep custom keys
  let sectionsChanged = false;
  for (const canonicalSection of canonical.sections) {
    const existing = state.store.themeConfig.sections.find(s => s.name === canonicalSection.name);
    if (!existing) {
      state.store.themeConfig.sections.push({ ...canonicalSection });
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


export function buildDefaultConfig(): RawThemeJson {
  const sections: Section[] = [
    { name: 'Backgrounds', keys: ['--ftr10-bg','--ftr10-bg-editor','--ftr10-bg-sticky','--ftr10-bg-image','--ftr10-bg-image-panels','--ftr10-panel-overlay','--ftr10-bg-activitybar','--ftr10-bg-sidebar','--ftr10-bg-panel-bottom','--ftr10-bg-panel-top','--ftr10-bg-auxiliarybar','--ftr10-bg-pattern','--ftr10-bg-pattern-size','--ftr10-bg-pattern-pos','--ftr10-bg-effect'] },
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

export function flattenConfig(raw: RawThemeJson): ThemeConfig {
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

function replaceCssVarRobust(css: string, key: string, newVal: string): string {
  let out = '';
  let cursor = 0;
  while (true) {
    const idx = css.indexOf(key, cursor);
    if (idx === -1) { out += css.slice(cursor); break; }
    // Verify it's a declaration: optional ws, then ':'
    let afterKey = idx + key.length;
    while (afterKey < css.length && /\s/.test(css[afterKey])) afterKey++;
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
        if (ch === "'" && css[k-1] !== '\\') inSingle = false;
      } else if (inDouble) {
        if (ch === '"' && css[k-1] !== '\\') inDouble = false;
      } else {
        if (ch === "'") inSingle = true;
        else if (ch === '"') inDouble = true;
        else if (ch === '(') depth++;
        else if (ch === ')') { if (depth>0) depth--; }
        else if (ch === ';' && depth === 0) break;
        else if (ch === '}' && depth === 0) break;
      }
      k++;
    }
    // Replace value segment with newVal
    out += ' ' + newVal;
    if (k < css.length && css[k] === ';') {
      out += ';';
      let next = k + 1;
      // consume extra consecutive semicolons (fixes previous ;; corruption)
      while (next < css.length && css[next] === ';') next++;
      cursor = next;
    } else {
      cursor = k;
    }
  }
  return out;
}

export function regenerateColorsCss(values: Record<string, string>): void {
  const cssPath = path.join(state.store.profilePath, 'css.files', 'colors.css');
  // Generate clean :root block — this fixes previous corruption (double ;; and background: prefix)
  const header = `/* FTR10 Codex — Token Definitions (auto-generated, do not edit manually — use Theme Editor) */\n:root {\n`;
  const lines = Object.entries(values)
    .filter(([k]) => k.startsWith('--ftr10-'))
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `  ${k}: ${v};`);
  const content = header + lines.join('\n') + '\n}\n';
  try {
    const existing = fs.existsSync(cssPath) ? fs.readFileSync(cssPath,'utf8') : '';
    if (existing !== content) fs.writeFileSync(cssPath, content);
  } catch { fs.writeFileSync(cssPath, content); }
}

export function updateAllCssFiles(values: Record<string, string>, changedKeys?: string[]): void {
  const cssDir = path.join(state.store.profilePath, 'css.files');
  if (!fs.existsSync(cssDir)) return;
  // colors.css is fully regenerated for cleanliness
  regenerateColorsCss(values);

  const keysToUpdate = changedKeys && changedKeys.length ? changedKeys : Object.keys(values).filter(k=>k.startsWith('--ftr10-'));
  if (keysToUpdate.length===0) return;
  let files: string[] = [];
  try { files = fs.readdirSync(cssDir).filter(f=>f.endsWith('.css') && f!=='colors.css'); } catch { return; }
  for (const file of files) {
    const fp = path.join(cssDir, file);
    try {
      let css = fs.readFileSync(fp,'utf8');
      let changed = false;
      let newCss = css;
      for (const key of keysToUpdate) {
        if (!newCss.includes(key)) continue;
        const before = newCss;
        newCss = replaceCssVarRobust(newCss, key, values[key]);
        if (before !== newCss) changed = true;
      }
      if (changed && newCss !== css) fs.writeFileSync(fp, newCss);
    } catch {}
  }
}

export function writeColorsCss(values: Record<string, string>, changedKeys?: string[]): void {
  updateAllCssFiles(values, changedKeys);
}

function getDefaultBgMode(presetId: string): 'effects' | 'solid' {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (!preset) return 'effects';
  return '--ftr10-bg' in preset.overrides ? 'solid' : 'effects';
}

export function getPresetBgMode(presetId: string): 'effects' | 'solid' {
  return state.store.themeConfig.presetBackgroundMode[presetId] ?? getDefaultBgMode(presetId);
}

export function getBasePresetValues(presetId: string): Record<string, string> {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  return { ...DEFAULT_VALUES, ...(preset?.overrides || {}) };
}

export function applyPreset(presetId: string): void {
  const preset = THEME_PRESETS.find(p => p.id === presetId);
  if (!preset) return;

  const baseValues = getBasePresetValues(presetId);
  const userCustomizations = state.store.themeConfig.presetCustomizations[presetId] || {};
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

  state.store.themeConfig.values = values;
  state.store.themeConfig.activePreset = presetId;
  persistThemeConfig();
  sourceP10kInTerminals();
  state.store.sidebarProvider?.syncActivePreset();
  if (isPanelAlive(state.store.CodexPanel)) {
    state.store.CodexPanel!.webview.postMessage({ command: 'activePresetChanged', activePreset: presetId });
  }
  const customCount = Object.keys(userCustomizations).length;
  const modeLabel = mode === 'effects' ? '✦ Effects' : '▣ Solid';
  const msg = customCount > 0
    ? `Theme "${preset.name}" applied [${modeLabel}] (${customCount} custom edit${customCount === 1 ? '' : 's'} restored).`
    : `Theme "${preset.name}" applied [${modeLabel}].`;
  vscode.window.showInformationMessage(msg);
}
