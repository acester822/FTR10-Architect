import * as vscode from 'vscode';
import { activateThemeSync, deactivateThemeSync } from './theme-sync';

export function activate(context: vscode.ExtensionContext): void {
  activateThemeSync(context);
}

export function deactivate(): void {
  deactivateThemeSync();
}
