import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import * as state from './state';

export function sourceP10kInTerminals(): void {
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
  if (!raw || depth > 8) return raw;
  const varRef = raw.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*?))?\s*\)$/);
  if (varRef) {
    const resolved = values[varRef[1]];
    const fallback = varRef[2]?.trim() || raw;
    return resolveTokenColor(resolved || fallback, values, depth + 1);
  }
  return toHex6(raw);
}

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

export function writeThemeTokenColors(values: Record<string, string>): void {
  const themePath = path.join(state.store.extensionRoot, 'themes', 'ftr10-base-color-theme.json');
  let theme: any;
  try {
    theme = JSON.parse(fs.readFileSync(themePath, 'utf8'));
  } catch (_) { return; }

  const tokensPath = path.join(state.store.profilePath, 'css.files', 'tokens.json');
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

// Cache of the last values we pushed to VS Code's tokenColorCustomizations.
// Writing these on every persist triggers VS Code's workbench to rebuild its
// injected <style> and transiently read .sheet.cssRules while null — which
// surfaces as a benign-but-noisy "Cannot read properties of null (reading
// 'cssRules')" in the browser console. Skipping writes when nothing changed
// eliminates the per-apply noise.
let _lastTokenColorValues: string | null = null;

export function writeTokenColors(values: Record<string, string>): void {
  const cacheKey = JSON.stringify(Object.keys(values).sort().map(k => [k, values[k]]));
  if (cacheKey === _lastTokenColorValues) return; // idempotent — nothing changed
  _lastTokenColorValues = cacheKey;

  const tokensPath = path.join(state.store.profilePath, 'css.files', 'tokens.json');
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

export function writeTerminalColors(profilePathArg: string, values: Record<string, string>): void {
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
