export interface Section {
  name: string;
  keys: string[];
}

export interface ArchitectSession {
  id: string;
  name: string;
  baseHue: number;
  harmony: string;
  swatchOverrides: Record<string, string>;
  savedColors: string[];
  bgEffect?: string;
  thpaceEnabled?: string;
  varOverrides?: Record<string, string>;  // extra --ftr10-* vars edited in the Vars panel, stored as a diff vs. the palette-derived set
  createdAt: number;
  updatedAt: number;
  isBase?: boolean;            // marks a seed Base card derived from a static preset
  basePresetId?: string;       // original preset id for reset capability
}

export interface ThemeConfig {
  sections: Section[];
  values: Record<string, string>;
  cssImports: string[];
  customCss: string;
  activePreset?: string;
  presetCustomizations: Record<string, Record<string, string>>;
  presetBackgroundMode: Record<string, 'effects' | 'solid'>;
  architectSessions: Record<string, ArchitectSession>;
  // Persisted drag positions for movable panels (varTables + legend wraps).
  // Keyed by element id; only set after the user repositions in Edit-Layout mode.
  layoutOverrides?: Record<string, { x: number; y: number }>;
}

export interface RawThemeJson {
  ftr10Variables?: { sections?: Section[]; values?: Record<string, string> } | Record<string, string>;
  cssImports?: string[];
  customCss?: string;
  lastModified?: number;
  activePreset?: string;
  presetCustomizations?: Record<string, Record<string, string>>;
  presetBackgroundMode?: Record<string, 'effects' | 'solid'>;
  architectSessions?: Record<string, ArchitectSession>;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: [string, string, string];
  overrides: Record<string, string>;
  solidBg?: string;  // opaque bg used when this preset is switched to solid mode
}
