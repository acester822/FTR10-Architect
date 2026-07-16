import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemeConfig, ArchitectSession, RawThemeJson } from './types';
import { SIMPLE_GROUPS, THEME_PRESETS, DEFAULT_VALUES } from './constants';
import { presetToBaseSession, deriveCodexPreset, computeSessionVarDiff } from './presets';
import { migrateConfig, buildDefaultConfig, flattenConfig, regenerateColorsCss, updateAllCssFiles, writeColorsCss, getPresetBgMode, getBasePresetValues, applyPreset } from './config';
import { sourceP10kInTerminals, writeThemeTokenColors, writeTokenColors, writeTerminalColors } from './css';
import { writeVarsJson, generateShim } from './shim';
import { buildSessionCardsHtml, getSidebarHtml, getCodexHtml, getEditorHtml } from './webview-html';
import * as state from './state';
import { isPanelAlive } from './state';

export function ensureBaseSessions(): boolean {
  let changed = false;
  // Create a base card for each static preset if not already present
  for (let idx = 0; idx < THEME_PRESETS.length; idx++) {
    const preset = THEME_PRESETS[idx];
    const baseId = `base-${preset.id}`;
    if (state.store.themeConfig.architectSessions[baseId]) continue;
    const session = presetToBaseSession(preset);
    // Stagger createdAt so original preset order is preserved (oldest first)
    session.createdAt = Date.now() - (THEME_PRESETS.length - idx) * 10000;
    session.updatedAt = session.createdAt;
    state.store.themeConfig.architectSessions[baseId] = session;
    changed = true;
  }
  return changed;
}

export function resetBaseSession(sessionId: string): void {
  const existing = state.store.themeConfig.architectSessions[sessionId];
  if (!existing?.isBase || !existing.basePresetId) return;
  const preset = THEME_PRESETS.find(p => p.id === existing.basePresetId);
  if (!preset) return;
  const fresh = presetToBaseSession(preset);
  // Preserve id and isBase flags but reset content to factory
  fresh.createdAt = existing.createdAt;
  fresh.updatedAt = Date.now();
  state.store.themeConfig.architectSessions[sessionId] = fresh;
  persistThemeConfig();
  state.store.sidebarProvider?.syncSessions();
  // If that base card is currently active, re-apply it
  if (state.store.themeConfig.activePreset === `arch-${sessionId}`) {
    applyArchitectSession(sessionId);
  }
  vscode.window.showInformationMessage(`Base card "${fresh.name}" reset to defaults.`);
}

function registerLivePanel(p: vscode.WebviewPanel | undefined): void {
  if (!p) return;
  if (state.store.livePanels.indexOf(p) === -1) state.store.livePanels.push(p);
}
function unregisterLivePanel(p: vscode.WebviewPanel | undefined): void {
  const i = p ? state.store.livePanels.indexOf(p) : -1;
  if (i !== -1) state.store.livePanels.splice(i, 1);
}

export function activateThemeSync(context: vscode.ExtensionContext): void {
  const configPath = vscode.workspace.getConfiguration('themeSync').get<string>('state.store.profilePath', '');
  state.store.profilePath = configPath || path.join(os.homedir(), '.ftr10');
  state.store.extensionRoot = context.extensionUri.fsPath;
  fs.mkdirSync(state.store.profilePath, { recursive: true });

  const themeJsonPath = path.join(state.store.profilePath, 'theme.json');
  if (!fs.existsSync(themeJsonPath)) {
    const defaults = buildDefaultConfig();
    fs.writeFileSync(themeJsonPath, JSON.stringify(defaults, null, 2));
    state.store.themeConfig = flattenConfig(defaults);
  } else {
    const raw = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8')) as RawThemeJson;
    state.store.themeConfig = flattenConfig(raw);
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
    regenerateColorsCss(state.store.themeConfig.values);
    // Also clean other css files of double semicolons via robust updater
    updateAllCssFiles(state.store.themeConfig.values, ['--ftr10-bg-image-panels', '--ftr10-highlight']);
  } catch {}

  // Register sidebar webview provider
  state.store.sidebarProvider = new ThemeSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('themeSync.sidebar', state.store.sidebarProvider)
  );

  const openPanelCmd = vscode.commands.registerCommand('themeSync.openPanel', () => {
    if (state.store.panel) state.store.panel.reveal(vscode.ViewColumn.One);
    else createPanel(context);
  });

  const patchCmd = vscode.commands.registerCommand('themeSync.patchWorkbench', () => patchWorkbench(state.store.profilePath));

  const applyPresetCmd = vscode.commands.registerCommand('themeSync.applyPreset', (presetId: string) => {
    applyPreset(presetId);
  });

  context.subscriptions.push(openPanelCmd, patchCmd, applyPresetCmd);

  state.store.watcher = chokidar.watch(themeJsonPath, { ignoreInitial: true });
  state.store.watcher.on('change', () => {
    try {
      const raw = JSON.parse(fs.readFileSync(themeJsonPath, 'utf8')) as RawThemeJson;
      state.store.themeConfig = flattenConfig(raw);
      generateShim(state.store.profilePath, state.store.themeConfig);
      updateWebviewUI();
      state.store.sidebarProvider?.syncActivePreset();
    } catch (err) {
      console.error('Error watching theme.json:', err);
    }
  });

  context.subscriptions.push({ dispose: () => state.store.watcher?.close() });
  generateShim(state.store.profilePath, state.store.themeConfig);
  writeVarsJson(state.store.profilePath, state.store.themeConfig);
}

export function deactivateThemeSync(): void {
  state.store.watcher?.close();
  state.store.panel?.dispose();
}

export class ThemeSidebarProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getSidebarHtml(state.store.themeConfig.activePreset, state.store.themeConfig.values['--ftr10-accent-1']);

    webviewView.onDidChangeVisibility(() => {
      if (!webviewView.visible && state.store.CodexPanel) {
        state.store.CodexPanel.dispose();
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
        const sess = state.store.themeConfig.architectSessions[id];
        if (sess?.isBase) {
          vscode.window.showWarningMessage('Base cards cannot be deleted — use Reset ↺ to restore defaults.');
          return;
        }
        delete state.store.themeConfig.architectSessions[id];
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
        accentColor: state.store.themeConfig.values['--ftr10-accent-1'] || ''
      });
      // Also re-sync active state so the badge reflects any preset changes
      this._view.webview.postMessage({
        command: 'syncActive',
        activePreset: state.store.themeConfig.activePreset || '',
        accentColor: state.store.themeConfig.values['--ftr10-accent-1'] || ''
      });
    }
  }

  syncActivePreset(): void {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'syncActive',
        activePreset: state.store.themeConfig.activePreset || '',
        accentColor: state.store.themeConfig.values['--ftr10-accent-1'] || ''
      });
    }
  }

  syncBgModes(): void {
    if (this._view) {
      const bgModeMap: Record<string, string> = {};
      for (const s of Object.values(state.store.themeConfig.architectSessions)) {
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

function handleMessage(msg: any): void {
  if (msg.command === 'getConfig') {
    if (state.store.panel) {
      const bgModeMap: Record<string, string> = {};
      for (const p of THEME_PRESETS) {
        bgModeMap[p.id] = getPresetBgMode(p.id);
      }
      state.store.panel.webview.postMessage({
        command: 'sync',
        config: state.store.themeConfig,
        simpleGroups: SIMPLE_GROUPS,
        presets: THEME_PRESETS,
        bgModeMap
      });
      setTimeout(() => {
        if (state.store.panel) {
          state.store.panel.webview.postMessage({
            command: 'sync',
            config: state.store.themeConfig,
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
    const presetId: string = msg.presetId || state.store.themeConfig.activePreset || '';
    if (!presetId) return;
    const current = getPresetBgMode(presetId);
    const next: 'effects' | 'solid' = current === 'effects' ? 'solid' : 'effects';
    state.store.themeConfig.presetBackgroundMode[presetId] = next;
    if (presetId === state.store.themeConfig.activePreset) {
      applyPreset(presetId);
    } else {
      persistThemeConfig();
    }
    if (state.store.panel) {
      const bgModeMap: Record<string, string> = {};
      for (const p of THEME_PRESETS) { bgModeMap[p.id] = getPresetBgMode(p.id); }
      state.store.panel.webview.postMessage({ command: 'syncBgMode', bgModeMap, activePreset: state.store.themeConfig.activePreset });
    }
    state.store.sidebarProvider?.syncBgModes();
    return;
  }

  if (msg.command === 'liveUpdate') {
    const prevValues = state.store.themeConfig.values;
    const newValues = msg.values || state.store.themeConfig.values;
    const presetId = msg.activePreset ?? state.store.themeConfig.activePreset;
    state.store.themeConfig = {
      sections: msg.sections || state.store.themeConfig.sections,
      values: newValues,
      cssImports: msg.cssImports || state.store.themeConfig.cssImports,
      customCss: msg.customCss ?? state.store.themeConfig.customCss,
      activePreset: presetId,
      presetCustomizations: state.store.themeConfig.presetCustomizations,
      presetBackgroundMode: state.store.themeConfig.presetBackgroundMode,
      architectSessions: state.store.themeConfig.architectSessions
    };
    if (presetId) {
      const baseValues = getBasePresetValues(presetId);
      const diff: Record<string, string> = {};
      for (const [key, val] of Object.entries(newValues)) {
        if (baseValues[key] !== val) { diff[key] = val as string; }
      }
      if (Object.keys(diff).length > 0) {
        state.store.themeConfig.presetCustomizations[presetId] = diff;
      } else {
        delete state.store.themeConfig.presetCustomizations[presetId];
      }
    }
    // compute changed keys for surgical CSS update (major lag fix + data URI support)
    const changedKeys: string[] = [];
    for (const k of Object.keys(newValues)) {
      if (prevValues[k] !== newValues[k]) changedKeys.push(k);
    }
    try {
      persistThemeConfig({ fast: true, changedKeys });
    } catch (e: any) {
      const msgTxt = (e && e.message) ? e.message : String(e);
      console.error('[FTR10] liveUpdate persistThemeConfig failed:', e);
      vscode.window.showErrorMessage('FTR10 live-update failed: ' + msgTxt);
    }
    state.store.sidebarProvider?.syncActivePreset();
    return;
  }

  if (msg.command === 'apply') {
    const newValues = msg.values || state.store.themeConfig.values;
    const presetId = msg.activePreset ?? state.store.themeConfig.activePreset;
    state.store.themeConfig = {
      sections: msg.sections || state.store.themeConfig.sections,
      values: newValues,
      cssImports: msg.cssImports || state.store.themeConfig.cssImports,
      customCss: msg.customCss ?? state.store.themeConfig.customCss,
      activePreset: presetId,
      presetCustomizations: state.store.themeConfig.presetCustomizations,
      presetBackgroundMode: state.store.themeConfig.presetBackgroundMode,
      architectSessions: state.store.themeConfig.architectSessions
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
        state.store.themeConfig.presetCustomizations[presetId] = diff;
      } else {
        delete state.store.themeConfig.presetCustomizations[presetId];
      }
    }

    persistThemeConfig();
    state.store.sidebarProvider?.syncActivePreset();
    sourceP10kInTerminals();
    vscode.window.showInformationMessage('Theme applied.');
    return;
  }

  if (msg.command === 'reset') {
    const presetId = state.store.themeConfig.activePreset;
    if (presetId) {
      // Clear customizations for the active preset, re-apply it fresh
      delete state.store.themeConfig.presetCustomizations[presetId];
      const baseValues = getBasePresetValues(presetId);
      state.store.themeConfig.values = baseValues;
    } else {
      // No active preset — full reset to defaults
      const defaults = buildDefaultConfig();
      const fresh = flattenConfig(defaults);
      state.store.themeConfig.sections = fresh.sections;
      state.store.themeConfig.values = fresh.values;
      state.store.themeConfig.cssImports = fresh.cssImports;
      state.store.themeConfig.customCss = fresh.customCss;
      state.store.themeConfig.activePreset = fresh.activePreset;
    }
    persistThemeConfig();
    if (state.store.panel) state.store.panel.webview.html = getEditorHtml(state.store.themeConfig);
    state.store.sidebarProvider?.syncActivePreset();
    const presetName = THEME_PRESETS.find(p => p.id === presetId)?.name || 'defaults';
    vscode.window.showInformationMessage(`Theme reset to ${presetName} defaults.`);
    return;
  }

  if (msg.command === 'applyPreset') {
    applyPreset(msg.presetId);
    return;
  }
}

export function persistThemeConfig(opts?: { fast?: boolean; changedKeys?: string[] }): void {
  if (state.store._togglingTheme) return;
  const isFast = !!opts?.fast;
  // Sanitize values: any background image expressed as a relative path or
  // file:// URL resolves against the workbench's CDN origin (vscode-cdn.net)
  // which cannot reach the local disk → ERR_NAME_NOT_RESOLVED. Such values can
  // only ever come from a pre-fix saved state; force them to 'none' so we never
  // re-emit a dead URL. (Live gallery selections are now data: URIs, which are fine.)
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.store.themeConfig.values)) {
    let val = String(v);
    if (k === '--ftr10-bg-image' || k === '--ftr10-bg-image-panels') {
      if (/^\s*url\(["']?\s*(\.\.\/|file:\/\/)/i.test(val)) val = 'none';
    }
    values[k] = val;
  }
  const themeJsonPath = path.join(state.store.profilePath, 'theme.json');
  fs.writeFileSync(themeJsonPath, JSON.stringify({
    ftr10Variables: { sections: state.store.themeConfig.sections, values },
    cssImports: state.store.themeConfig.cssImports,
    customCss: state.store.themeConfig.customCss,
    activePreset: state.store.themeConfig.activePreset,
    presetCustomizations: state.store.themeConfig.presetCustomizations,
    presetBackgroundMode: state.store.themeConfig.presetBackgroundMode,
    architectSessions: state.store.themeConfig.architectSessions,
    lastModified: Date.now()
  }, null, 2));
  // Fast path: only update css files, vars.json, shim.js and live relay — skip heavy token writes
  if (isFast) {
    writeColorsCss(values, opts?.changedKeys);
    writeVarsJson(state.store.profilePath, { ...state.store.themeConfig, values });
    generateShim(state.store.profilePath, { ...state.store.themeConfig, values });
    pushVarsLive(values);
    // still update editor webview UI but not full sync
    updateWebviewUI();
    return;
  }
  writeColorsCss(values, opts?.changedKeys);
  writeVarsJson(state.store.profilePath, { ...state.store.themeConfig, values });
  generateShim(state.store.profilePath, { ...state.store.themeConfig, values });
  writeTerminalColors(state.store.profilePath, state.store.themeConfig.values);
  // VS Code syntax color syncing was previously disabled due to broken highlight behavior.
  // User requested re-enabling full token synchronization (theme JSON + settings toggle).
  try {
    writeThemeTokenColors(state.store.themeConfig.values);
  } catch (e) {
    console.error('writeThemeTokenColors failed:', e);
  }
  try {
    writeTokenColors(state.store.themeConfig.values);
  } catch (e) {
    console.error('writeTokenColors failed:', e);
  }
  pushVarsLive(state.store.themeConfig.values);
  updateWebviewUI();
}

export function pushVarsLive(values: Record<string, string>): void {
  const msg = { command: 'relayVars', cssVars: values };
  // Relay to every currently-open webview panel (Theme Editor AND Architect).
  // The webview scripts forward relayVars onto BroadcastChannel('theme-sync'),
  // which the injected shim listens on and applies live — no dependency on the
  // workbench's fetch() being able to reach vars.json across window origins.
  for (const vw of state.store.livePanels) {
    try { vw.webview.postMessage(msg); } catch (_) {}
  }
  state.store.sidebarProvider?.pushVars(values);
}

function createPanel(context: vscode.ExtensionContext): void {
  state.store.panel = vscode.window.createWebviewPanel('themeSyncPanel', 'FTR10 Theme Editor', vscode.ViewColumn.One, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [vscode.Uri.file(path.join(process.env.HOME || require('os').homedir(), '.ftr10'))]
  });
  state.store.panel.webview.html = getEditorHtml(state.store.themeConfig);
  const _panelRef = state.store.panel;
  state.store.panel.onDidDispose(() => { unregisterLivePanel(_panelRef); state.store.panel = undefined; }, null, context.subscriptions);
  registerLivePanel(state.store.panel);
  state.store.panel.webview.onDidReceiveMessage(handleMessage, undefined, context.subscriptions);
}

function updateWebviewUI(): void {
  if (state.store.panel) {
    const bgModeMap: Record<string, string> = {};
    for (const p of THEME_PRESETS) { bgModeMap[p.id] = getPresetBgMode(p.id); }
    // Background gallery: read image files at <globalConfig>/backgrounds and
    // ship them as inline base64 data: URIs. The webview is an isolated
    // origin whose asWebviewUri() resolves to an unreachable CDN in this
    // code-server setup, so a plain URL 404s (ERR_NAME_NOT_RESOLVED).
    // data: URIs need no external host and always load.
    const bgDir = path.join((process.env.HOME || require('os').homedir()), '.ftr10', 'backgrounds');
    let bgImages: { name: string; dataUri: string }[] = [];
    try {
      if (fs.existsSync(bgDir)) {
        bgImages = fs.readdirSync(bgDir)
          .filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f))
          .sort((a, b) => a.localeCompare(b))
          .map(f => {
            const mime = /\.svg$/i.test(f) ? 'image/svg+xml'
              : /\.png$/i.test(f) ? 'image/png'
              : /\.gif$/i.test(f) ? 'image/gif'
              : /\.webp$/i.test(f) ? 'image/webp'
              : /\.avif$/i.test(f) ? 'image/avif'
              : 'image/jpeg';
            const b64 = fs.readFileSync(path.join(bgDir, f)).toString('base64');
            return { name: f, dataUri: 'data:' + mime + ';base64,' + b64 };
          });
      }
    } catch { /* ignore — gallery simply empty */ }
    state.store.panel.webview.postMessage({
      command: 'sync',
      config: state.store.themeConfig,
      simpleGroups: SIMPLE_GROUPS,
      presets: THEME_PRESETS,
      bgModeMap,
      bgImages
    });
  }
}

function applyArchitectSession(sessionId: string): void {
  const session = state.store.themeConfig.architectSessions[sessionId];
  if (!session) return;
  const preset = deriveCodexPreset(session);
  const existingIdx = THEME_PRESETS.findIndex(p => p.id === preset.id);
  if (existingIdx >= 0) { THEME_PRESETS[existingIdx] = preset; }
  else { THEME_PRESETS.push(preset); }
  applyPreset(preset.id);
  state.store.sidebarProvider?.syncSessions();
  // If Architect panel is open, switch it to this session
  if (isPanelAlive(state.store.CodexPanel)) {
    state.store.CodexPanel!.webview.postMessage({ command: 'loadSession', session, derivedValues: state.store.themeConfig.values });
  }
}

function createCodexPanel(context: vscode.ExtensionContext, sessionId?: string): void {
  if (state.store.CodexPanel) {
    state.store.CodexPanel.reveal(vscode.ViewColumn.One);
    if (sessionId) {
      const session = state.store.themeConfig.architectSessions[sessionId];
      if (session) {
        const derivedValues = state.store.themeConfig.activePreset === `arch-${sessionId}` ? state.store.themeConfig.values : undefined;
        state.store.CodexPanel.webview.postMessage({ command: 'loadSession', session, derivedValues });
      }
    }
    return;
  }
  state.store.CodexPanel = vscode.window.createWebviewPanel(
    'state.store.CodexPanel', 'FTR10 Architect', vscode.ViewColumn.One,
    { enableScripts: true, retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(path.join(process.env.HOME || require('os').homedir(), '.ftr10'))] }
  );

  // Gather initial data at panel-creation time and bake it directly into the HTML.
  // This mirrors the pattern used by getSidebarHtml() and ensures the webview renders
  // real config/palette data on the very first paint — before any postMessage round-trip.
  let _initBgImages: { name: string; dataUri: string }[] = [];
  try {
    const bgDir = path.join((process.env.HOME || require('os').homedir()), '.ftr10', 'backgrounds');
    if (fs.existsSync(bgDir)) {
      _initBgImages = fs.readdirSync(bgDir)
        .filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f))
        .sort((a, b) => a.localeCompare(b))
        .slice(0, 20)
        .map(f => ({ name: f, dataUri: '' }));
    }
  } catch (e) { console.error('FTR10: Failed to read background images for Architect panel:', e); }
  // sections: the webview hydration only reads config.sections; sanitizeConfigForWebview
  // would deep-clone the entire ThemeConfig (incl. architectSessions) just for this,
  // so pass sections directly — they contain no sensitive data.
  const _initValues = sanitizeForWebview(state.store.themeConfig.values);
  let _initSession: any = undefined;
  let _initDerivedValues: Record<string, any> | undefined = undefined;
  if (sessionId) {
    const _sess = state.store.themeConfig.architectSessions[sessionId];
    if (_sess) {
      _initSession = sanitizeSession(_sess);
      _initDerivedValues = sanitizeForWebview(
        state.store.themeConfig.activePreset === `arch-${sessionId}` ? state.store.themeConfig.values : {}
      );
    }
  }
  state.store.CodexPanel.webview.html = getCodexHtml({
    config: { sections: state.store.themeConfig.sections },
    simpleGroups: SIMPLE_GROUPS,
    activePreset: state.store.themeConfig.activePreset,
    values: _initValues,
    bgImages: _initBgImages,
    session: _initSession,
    derivedValues: _initDerivedValues
  });

  const _codexRef = state.store.CodexPanel;
  state.store.CodexPanel.onDidDispose(() => { unregisterLivePanel(_codexRef); state.store.CodexPanel = undefined; }, null, context.subscriptions);
  registerLivePanel(state.store.CodexPanel);

  // Safety-net fallback: re-push architectConfig ~350 ms after creation in case the
  // extension host restarted (retainContextWhenHidden causes the webview to persist
  // but the in-HTML baked data may be stale after a restart).  This is idempotent —
  // the webview merges the incoming values on top of what it already has.
  setTimeout(() => {
    try {
      if (!isPanelAlive(state.store.CodexPanel)) { return; }
      let bgImages: { name: string; dataUri: string }[] = [];
      try {
        const bgDir = path.join((process.env.HOME || require('os').homedir()), '.ftr10', 'backgrounds');
        if (fs.existsSync(bgDir)) {
          bgImages = fs.readdirSync(bgDir)
            .filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f))
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 20)
            .map(f => ({ name: f, dataUri: '' }));
        }
      } catch {}
      const safeConfig = sanitizeConfigForWebview(state.store.themeConfig);
      const safeVals = sanitizeForWebview(state.store.themeConfig.values);
      state.store.CodexPanel.webview.postMessage({ command: 'architectConfig', config: safeConfig, simpleGroups: SIMPLE_GROUPS, activePreset: state.store.themeConfig.activePreset, values: safeVals, bgImages });
    } catch {}
  }, 350);

  state.store.CodexPanel.webview.onDidReceiveMessage((msg: any) => {
    if (msg.command === 'CodexUpdate' && Array.isArray(msg.colors)) {
      state.store.sidebarProvider?.pushCodexColors(msg.colors);
    }

    if (msg.command === 'getConfig') {
      const bgDir = path.join((process.env.HOME || require('os').homedir()), '.ftr10', 'backgrounds');
      let bgImages: { name: string; dataUri: string }[] = [];
      try {
        if (fs.existsSync(bgDir)) {
          bgImages = fs.readdirSync(bgDir)
            .filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f))
            .sort((a, b) => a.localeCompare(b))
            .map(f => {
              const mime = /\.svg$/i.test(f) ? 'image/svg+xml'
                : /\.png$/i.test(f) ? 'image/png'
                : /\.gif$/i.test(f) ? 'image/gif'
                : /\.webp$/i.test(f) ? 'image/webp'
                : /\.avif$/i.test(f) ? 'image/avif'
                : 'image/jpeg';
              const b64 = fs.readFileSync(path.join(bgDir, f)).toString('base64');
              return { name: f, dataUri: 'data:' + mime + ';base64,' + b64 };
            });
        }
      } catch { /* ignore */ }
      state.store.CodexPanel?.webview.postMessage({ command: 'architectConfig', config: state.store.themeConfig, simpleGroups: SIMPLE_GROUPS, activePreset: state.store.themeConfig.activePreset, values: state.store.themeConfig.values, bgImages });
    }

    if (msg.command === 'liveUpdate' && msg.values) {
      const changedKeys = Object.keys(msg.values);
      state.store.themeConfig.values = { ...state.store.themeConfig.values, ...msg.values };
      persistThemeConfig({ fast: true, changedKeys });
    }

    if (msg.command === 'saveSession' && Array.isArray(msg.colors) && msg.colors.length >= 6) {
      // If sessionId is provided, overwrite that card; otherwise create a new one
      const id: string = msg.sessionId || Date.now().toString(36);
      const existing = state.store.themeConfig.architectSessions[id];
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
          msg.vars || state.store.themeConfig.values
        ),
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        isBase: existing?.isBase ?? false,
        basePresetId: existing?.basePresetId
      };
      state.store.themeConfig.architectSessions[id] = session;
      persistThemeConfig();
      state.store.sidebarProvider?.syncSessions();
      state.store.CodexPanel?.webview.postMessage({ command: 'sessionSaved', sessionId: id, name: session.name });
      vscode.window.showInformationMessage(`Session "${session.name}" saved.`);
    }

    if (msg.command === 'applySession' && Array.isArray(msg.colors) && msg.colors.length >= 6) {
      const id: string = msg.sessionId || Date.now().toString(36);
      const existing = state.store.themeConfig.architectSessions[id];
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
        msg.vars || state.store.themeConfig.values
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
      state.store.themeConfig.architectSessions[id] = session;
      const preset = deriveCodexPreset(session);
      const existingIdx = THEME_PRESETS.findIndex(p => p.id === preset.id);
      if (existingIdx >= 0) { THEME_PRESETS[existingIdx] = preset; }
      else { THEME_PRESETS.push(preset); }
      applyPreset(preset.id);
      // applyPreset() rebuilds state.store.themeConfig.values from the derived preset, which
      // already includes varOverrides (see deriveCodexPreset). Re-assert the diff
      // onto the live config so the user's Vars-panel edits survive the apply and
      // get persisted as presetCustomizations for the active arch preset.
      state.store.themeConfig.values = { ...state.store.themeConfig.values, ...varDiff };
      persistThemeConfig();
      state.store.sidebarProvider?.syncSessions();
      state.store.CodexPanel?.webview.postMessage({ command: 'sessionSaved', sessionId: id, name: session.name });
      vscode.window.showInformationMessage(`"${session.name}" applied.`);
    }
  }, undefined, context.subscriptions);
}

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
      writeVarsJson(profilePathArg, state.store.themeConfig);
    }
    try {
      if (fs.existsSync(varsLinkPath)) fs.unlinkSync(varsLinkPath);
    } catch (_e) { /* ignore */ }
    fs.symlinkSync(varsSrcPath, varsLinkPath);

    // Symlink the backgrounds dir so the workbench origin can serve them.
    // effects.css paints `--ftr10-bg-image: url("../backgrounds/<file>")` which
    // resolves relative to the served css.files/ location (the workbench dir).
    const bgDirSrc = path.join(profilePathArg, 'backgrounds');
    const bgDirLink = path.join(workbenchDir, 'backgrounds');
    if (fs.existsSync(bgDirSrc)) {
      try { if (fs.existsSync(bgDirLink)) fs.unlinkSync(bgDirLink); } catch (_e) { /* ignore */ }
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
    try { if (fs.existsSync(cssDirLink)) fs.unlinkSync(cssDirLink); } catch {}
    try { if (fs.existsSync(cssDirSrc)) fs.symlinkSync(cssDirSrc, cssDirLink); } catch {}
    vscode.window.showInformationMessage('Workbench patched with shim.js');
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to patch workbench: ${err?.message || err}`);
  }
}

/**
 * Produce a plain, serializable deep-clone of a value safe to embed in webview
 * HTML / postMessage. The theme config and its values are plain data (strings,
 * arrays, nested records) with no functions or classes, so a JSON round-trip is
 * the correct sanitizer: it strips any non-serializable fields and yields a fresh
 * object the webview can own without shared references into the extension host.
 */
function sanitizeForWebview(v: any): any {
  if (v === undefined || v === null) return v;
  try { return JSON.parse(JSON.stringify(v)); } catch { return {}; }
}

/** Sanitize an ArchitectSession for webview consumption (plain deep-clone). */
function sanitizeSession(s: any): any {
  return sanitizeForWebview(s);
}

/** Sanitize the full ThemeConfig for webview consumption (plain deep-clone). */
function sanitizeConfigForWebview(c: any): any {
  return sanitizeForWebview(c);
}
