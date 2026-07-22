import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as chokidar from 'chokidar';
import type { ThemeConfig } from './types';

// Shared mutable extension state. A single const object whose properties are
// mutable, so other modules can do `state.store.themeConfig = ...` (namespace
// imports are read-only, but a const object's properties are not).
export const store = {
  panel: undefined as vscode.WebviewPanel | undefined,
  CodexPanel: undefined as vscode.WebviewPanel | undefined,
  livePanels: [] as vscode.WebviewPanel[],
  sidebarProvider: undefined as any,
  watcher: undefined as chokidar.FSWatcher | undefined,
  themeConfig: { sections: [], values: {}, cssImports: [], customCss: '', presetCustomizations: {}, presetBackgroundMode: {}, architectSessions: {} } as ThemeConfig,
  profilePath: '',
  extensionRoot: '',
  _togglingTheme: false,
};

/**
 * True only when a webview panel both exists AND still has a live webview.
 * A panel reference can survive `dispose()` of its underlying webview when
 * `retainContextWhenHidden: true` is set — `state.store.CodexPanel` stays a
 * non-null object but `panel.webview.postMessage(...)` then throws
 * "Webview is disposed" (mN.assertNotDisposed). Always gate postMessage on
 * this rather than a bare null-check.
 */
export function isPanelAlive(p: vscode.WebviewPanel | undefined): boolean {
  if (!p) return false;
  try {
    // A disposed panel's reference can linger (e.g. retainContextWhenHidden), so a
    // bare null-check is not enough. We flag disposal ourselves on the dispose
    // handler and probe that flag here. Cast is safe — only our own marker is read.
    return !(p as unknown as { __ftr10Disposed?: boolean }).__ftr10Disposed;
  } catch {
    return false;
  }
}
