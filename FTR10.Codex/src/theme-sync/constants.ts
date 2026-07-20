import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemePreset } from './types';
import * as state from './state';

export const SIMPLE_GROUPS: { label: string; keys: string[] }[] = [
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
      '--ftr10-body-font', '--ftr10-heading-font', '--ftr10-code-font'
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

import neonMatrix from '../theme-presets/neon-matrix';
import midnightViolet from '../theme-presets/midnight-violet';
import oceanBreeze from '../theme-presets/ocean-breeze';
import solarFlare from '../theme-presets/solar-flare';
import roseQuartz from '../theme-presets/rose-quartz';
import arcticFrost from '../theme-presets/arctic-frost';
import emberGlow from '../theme-presets/ember-glow';
import monochrome from '../theme-presets/monochrome';
import popoverUniverse from '../theme-presets/popover-universe';
import emeraldForest from '../theme-presets/emerald-forest';
import acesCodepunk from '../theme-presets/aces-codepunk';
import classicMonokai from '../theme-presets/classic-monokai';
import classicAtomMaterial from '../theme-presets/classic-atom-material';

export const THEME_PRESETS: ThemePreset[] = [
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
  classicAtomMaterial,
];
// ═══════════════════════════════════════════════════════════════════
// Default values
// ═══════════════════════════════════════════════════════════════════

export const DEFAULT_VALUES: Record<string, string> = {
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
