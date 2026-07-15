Patch theme-sync.ts please, 

```javascript
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
    migrateConfig();  // Forward-fills any missing vars from DEFAULT_VALUES
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

  // Register commands
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
      generateShim(profilePath, themeConfig);
      updateWebviewUI();
      sidebarProvider?.syncActivePreset();
    } catch (err) {
      console.error('Error watching theme.json:', err);
    }
  });

  context.subscriptions.push({ dispose: () => watcher?.close() });

  // Single source of truth: theme.json -> all generated artifacts.
  // Regenerate colors.css from themeConfig (repair corruption if needed),
  // then derive vars.json / shim / tokens from themeConfig. colors.css is a
  // generated output and is NOT fed back upstream.
  try { regenerateColorsCss(themeConfig.values); } catch {}
  generateShim(profilePath, themeConfig);
  writeVarsJson(profilePath, themeConfig);
  writeTerminalColors(profilePath, themeConfig.values);
  try { writeThemeTokenColors(themeConfig.values); } catch (e) { console.error('writeThemeTokenColors failed:', e); }
  try { writeTokenColors(themeConfig.values); } catch (e) { console.error('writeTokenColors failed:', e); }
  pushVarsLive(themeConfig.values);
  updateWebviewUI();
}

export function deactivateThemeSync(): void {
  watcher?.close();
  panel?.dispose();
}

```