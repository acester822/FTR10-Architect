// Re-export the public surface previously provided by the monolithic
// src/theme-sync.ts so existing importers (extension.ts, src/theme-presets/*)
// keep working unchanged after the extension-host logic was split into ./theme-sync/*.
export { activateThemeSync, deactivateThemeSync } from './theme-sync/activation';
export { accentDerived } from './theme-sync/presets';
export type { ThemePreset } from './theme-sync/types';
