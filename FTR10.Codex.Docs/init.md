# FTR10 Codex — Initialization & Architecture Reference

> **Verified against live source on 2026-04-17.**
> **Updated 2026-04-28** — Architect session system added (see §18).
> Source files: `src/extension.ts`, `src/theme-sync.ts`, `src/extension-common.ts`, `src/utils.ts`, `package.json`

---

## 1. Extension Identity  

| Field | Value |
|---|---|
| Folder | `/home/ftr/FTR10.Codex` |
| Manifest | `/home/ftr/FTR10.Codex/package.json` |
| Extension ID | `acester822.ftr10-codex` |
| Display name | `FTR10 Codex` |
| Version | `0.10.0` |
| Icon | `media/logo.png` |
| Preview engine | Embedded via `crossnote/` sub-package (not a separate extension) |
| Global config dir | `~/.ftr10` (returned by `getGlobalConfigPath()` in `src/utils.ts`) |

---

## 2. Source Layout

```
/home/ftr/FTR10.Codex/
├── package.json                  Extension manifest — commands, views, config schema
├── build.js                      esbuild entry point (native + web bundles)
├── install-extension.sh          Build → package → install helper
├── tsconfig.json
├── src/
│   ├── extension.ts              Activation entry point — wires preview + theme-sync
│   ├── extension-common.ts       Crossnote/preview command bridge
│   ├── theme-sync.ts             Theme engine — presets, sidebar, editor, shim, workbench patching
│   ├── preview-provider.ts       Markdown preview webview provider
│   ├── notebooks-manager.ts      Notebook/workspace config management
│   ├── utils.ts                  globalConfigPath (~/.ftr10), helpers
│   ├── config.ts                 Crossnote config wrappers
│   ├── image-helper.ts           Image upload/insert backend
│   ├── backlinks-provider.ts     Backlinks panel
│   ├── file-watcher.ts           fs.watch wrapper
│   ├── vscode-fs.ts              VS Code FS abstraction
│   ├── extension-web.ts          Web-target activation (browser worker)
│   └── preview-custom-editor-provider.ts
└── crossnote/                    Embedded preview library (pnpm workspace)
    └── src/
        └── webview/
            └── components/
                └── ThemeCustomizer.tsx   In-preview CSS var UI
```

---

## 3. Runtime Profile Directory

```
~/.ftr10/
├── theme.json                    Master theme config (25 sections, 282 vars)
├── vars.json                     Live bridge — polled by shim (adaptive timer)
├── shim.js                       Generated IIFE loaded as ES module in workbench (this should regenerate automatically on extension reload)
├── terminal-colors.zsh           Auto-generated — exports FTR10_ACCENT1/2/3 for P10k
├── style.less                    Legacy crossnote user style (present on disk, NOT written by theme-sync)
├── config.js                     Preview engine config (opened by customizeCSS command path)
├── parser.js                     Preview engine custom parser
├── head.html                     Preview engine custom head HTML
├── workbench.html                FTR10 workbench overlay entry point
└── css.files/
    ├── colors.css                :root { --ftr10-* } design tokens — updated by writeColorsCss()
    ├── main.css                  ~2270 lines — sidebar glass, tabs, editor UI, etc.
    ├── font_load.css             Font face imports
    ├── effects.css               Background overlay classes (kaleidoscope, aurora, nebula, crt)
    ├── tokens.json               TextMate/semantic scope map — read by writeTokenColors()
    ├── thpace.min.js             Thpace GL library v2.0.3 (bundled)
    └── thpace-background.js      Thpace init shim — canvas, window.ftr10Thpace API
```

---

## 4. Workbench Patching (one-time setup)

Run: **FTR10 Codex: Patch workbench.html** (`themeSync.patchWorkbench`)

```
/usr/lib/code-server/lib/vscode/out/vs/code/browser/workbench/
├── workbench.html        Patched: <script type="module" src="./shim.js"> injected before workbench.js
├── shim.js       ──────► symlink → ~/.ftr10/shim.js
├── vars.json     ──────► symlink → ~/.ftr10/vars.json
└── css.files/    ──────► symlink → ~/.ftr10/css.files/
```

`patchWorkbench()` (`theme-sync.ts:2438`):

> **Note (2026-07-15):** This is broke, it injects the incorrect shim location, should be injecting this line: `<script type="module" src="{{WORKBENCH_WEB_BASE_URL}}/out/vs/code/browser/workbench/shim.js"></script>`

1. Unlinks and recreates `shim.js` symlink
2. Ensures `vars.json` exists, then symlinks it
3. Reads `workbench.html` and checks for existing shim injection; if absent, inserts the `<script>` tag
---

## 5. Activation Flow

```
code-server starts
        │
        ▼
src/extension.ts  activate()
        │
        ├─ Ensures ~/.ftr10 exists (fs.mkdirSync if needed)
        │
        ├─ Registers fs.watch on ~/.ftr10 for config.js / parser.js / head.html changes
        │   └─ on change → PreviewProvider.notebooksManager?.updateAllNotebooksConfig()
        │
        ├─ await initExtensionCommon(context)
        │   └─ registers all markdown-preview-aces-edition.* commands
        │   └─ registers _crossnote.writeUserStyle → writes user-style.css to globalStorageUri
        │
        └─ activateThemeSync(context)
            │
            ├─ Loads / creates ~/.ftr10/theme.json
            ├─ migrateConfig() — forward-fills any missing vars from DEFAULT_VALUES
            ├─ Registers ThemeSidebarProvider (themeSync.sidebar)
            ├─ Registers commands: themeSync.openPanel, themeSync.patchWorkbench, themeSync.applyPreset
            ├─ Starts chokidar watcher on theme.json
            │   └─ on change → flattenConfig() → persistThemeConfig() → sidebarProvider.syncActivePreset()
            ├─ generateShim(profilePath, themeConfig) — writes shim.js
            └─ writeVarsJson(profilePath, themeConfig) — writes vars.json
```

---

## 6. Theme Persist Flow

Triggered by: **Apply & Sync**, **liveUpdate debounce**, **applyPreset**, **file watcher**, **migrateConfig**.

```
persistThemeConfig()  [theme-sync.ts:2080]
        │
        ├─ fs.writeFileSync  ~/.ftr10/theme.json  (full config + lastModified)
        │
        ├─ writeColorsCss(values)  [theme-sync.ts:1802]
        │   └─ Regex-updates each --ftr10-* declaration in ~/.ftr10/css.files/colors.css
        │       (does NOT rewrite the file — surgically replaces only changed values)
        │
        ├─ writeVarsJson(profilePath, cfg)  [theme-sync.ts:2320]
        │   └─ writes { values, lastModified } to ~/.ftr10/vars.json
        │
        ├─ generateShim(profilePath, cfg)  [theme-sync.ts:2337]
        │   └─ rewrites ~/.ftr10/shim.js (full IIFE regeneration)
        │
        ├─ writeTerminalColors(profilePath, values)  [theme-sync.ts:2273]
        │   └─ strips alpha from 8-digit hex, writes ~/.ftr10/terminal-colors.zsh
        │
        ├─ writeTokenColors(values)  [theme-sync.ts:2227]
        │   ├─ reads ~/.ftr10/css.files/tokens.json
        │   ├─ substitutes --ftr10-token-* values (via TOKEN_NAME_MAP + SEMANTIC_TOKEN_MAP)
        │   └─ writes to VS Code settings:
        │       editor.tokenColorCustomizations    (textMateRules)
        │       editor.semanticTokenColorCustomizations  (rules)
        │
        ├─ pushVarsLive(values)  [theme-sync.ts:2100]
        │   ├─ panel?.webview.postMessage({ command:'relayVars', cssVars })
        │   └─ sidebarProvider?.pushVars(values)
        │
        └─ updateWebviewUI()  [theme-sync.ts:2302]
            └─ posts { command:'sync', config, SIMPLE_GROUPS, THEME_PRESETS, bgModeMap }
               to editor panel webview
```

---

## 7. Live Workbench Update (shim polling)

```
Extension persists → writes vars.json { values, lastModified }
                                │
             ┌──────────────────┘
             │     workbench browser context
             ▼
    shim.js polls vars.json?t=Date.now()
    ┌─ IDLE mode: every 30 s
    └─ BURST mode: every 1.5 s for 8 s after a change is detected, then reverts

    if lastModified differs from last known:
        ├─ applies --ftr10-* vars to <style id="theme-sync-live-style"> with !important
        ├─ triggers __applyEffect() → manages #ftr10-effect-layer <div> on <body>
        ├─ calls window.ftr10Thpace.enable() or .disable() based on --ftr10-thpace-enabled
        └─ enters BURST mode for 8 s

Also receives live relay (no polling wait needed):
    extension postMessage('relayVars')
        └─ sidebar/editor webview forwards via BroadcastChannel('theme-sync')
               └─ shim listener picks up and applies immediately
```

---

## 8. File Responsibilities (what writes what)

| File written | Written by | Trigger |
|---|---|---|
| `~/.ftr10/theme.json` | `persistThemeConfig()` | Any apply/preset/migrate |
| `~/.ftr10/css.files/colors.css` | `writeColorsCss()` | Every persist |
| `~/.ftr10/vars.json` | `writeVarsJson()` | Every persist + activation |
| `~/.ftr10/shim.js` | `generateShim()` | Every persist + activation |
| `~/.ftr10/terminal-colors.zsh` | `writeTerminalColors()` | Every persist |
| `editor.tokenColorCustomizations` | `writeTokenColors()` | Every persist |
| `editor.semanticTokenColorCustomizations` | `writeTokenColors()` | Every persist |
| `{globalStorageUri}/user-style.css` | `writeUserStyle()` in `extension-common.ts` | Preview ThemeCustomizer save |
| `~/.ftr10/style.less` | **Nothing in current source** | Legacy file — present on disk but unused by theme-sync |

---

## 9. Commands Reference

### Theme Sync Commands

| Command ID | Display name | Handler |
|---|---|---|
| `themeSync.openPanel` | FTR10 Codex: Open Theme Editor | `createPanel()` |
| `themeSync.patchWorkbench` | FTR10 Codex: Patch workbench.html | `patchWorkbench()` |
| `themeSync.applyPreset` | FTR10 Codex: Apply Preset | `applyPreset(presetId)` |

### Preview / MPAE Commands (from `extension-common.ts` + `extension.ts`)

| Command ID | Purpose |
|---|---|
| `markdown-preview-aces-edition.openPreview` | Open preview in current column |
| `markdown-preview-aces-edition.openPreviewToTheSide` | Open preview to the side |
| `markdown-preview-aces-edition.customizeCss` | Opens `~/.ftr10/css.files/colors.css` |
| `markdown-preview-aces-edition.openConfigScript` | Opens `~/.ftr10/config.js` |
| `markdown-preview-aces-edition.extendParser` | Opens `~/.ftr10/parser.js` |
| `markdown-preview-aces-edition.customizePreviewHtmlHead` | Opens `~/.ftr10/head.html` |
| `markdown-preview-aces-edition.showUploadedImages` | Opens `~/.ftr10/image_history.md` |
| `markdown-preview-aces-edition.openImageHelper` | Opens image insert panel |
| `markdown-preview-aces-edition.runAllCodeChunks` | Runs all code chunks in preview |
| `markdown-preview-aces-edition.syncPreview` | Syncs editor scroll with preview |
| `markdown-preview-aces-edition.insertTable` | Inserts table template |
| `markdown-preview-aces-edition.createTOC` | Generates table of contents |

---

## 10. Preset Architecture

> **Note (2026-04-28):** Static presets are preserved in code but no longer shown in the sidebar UI. Sidebar cards are now Architect sessions only (see §18). `THEME_PRESETS[]` remains available for future use or reference.

### Groups (15 total)

| Group | Count | IDs |
|---|---|---|
| FTR10 Defaults | 8 | `neon-matrix`, `midnight-violet`, `ocean-breeze`, `solar-flare`, `rose-quartz`, `arctic-frost`, `ember-glow`, `monochrome` |
| MPAE / Generator | 3 | `popover-universe`, `emerald-forest`, `aces-codepunk` |
| Classic | 4 | `classic-monokai`, `classic-night`, `classic-atom-material`, `classic-solarized-dark` |

### Preset Object Shape

```ts
interface ThemePreset {
  id: string;
  name: string;
  description: string;
  colors: [string, string, string];   // accent swatch display colors
  overrides: Record<string, string>;  // --ftr10-* values that differ from DEFAULT_VALUES
  solidBg?: string;                   // opaque bg used when mode = 'solid'
}
```

### Background Modes (per preset, independently stored)

| Mode | `--ftr10-bg` | Thpace |
|---|---|---|
| `effects` | transparent (or CSS var) | enabled |
| `solid` | uses `preset.solidBg` or `preset.overrides['--ftr10-bg']` | disabled |

Default mode is inferred from each preset: if the preset's `overrides` include a literal `--ftr10-bg`, it defaults to `'solid'`; otherwise `'effects'`.

### Per-Preset Customizations

When a user edits variables and clicks Apply, the extension diffs current values against the base preset and stores only changed keys in `presetCustomizations[presetId]` inside `theme.json`. Switching away and back restores those customizations. The **Reset** button deletes only that preset's entry.

---

## 11. Editor Panel Messages

| Message (webview → extension) | Handled by | Effect |
|---|---|---|
| `getConfig` | `handleMessage` | Sends current config back |
| `liveUpdate` | `handleMessage` | Diffs + persists silently (2 s debounce auto-save trigger) |
| `apply` | `handleMessage` | Diffs + persists + sources p10k in terminals |
| `reset` | `handleMessage` | Clears `presetCustomizations[activePreset]` then persists |
| `applyPreset` | `handleMessage` | Calls `applyPreset(presetId)` |
| `toggleBackgroundMode` | `handleMessage` | Flips `presetBackgroundMode[presetId]`, re-applies if active |

| Message (extension → webview) | Content |
|---|---|
| `sync` | Full config + `SIMPLE_GROUPS` + `THEME_PRESETS` + `bgModeMap` |
| `relayVars` | `{ cssVars: values }` — forwarded via BroadcastChannel for shim |
| `syncBgMode` | `{ bgModeMap, activePreset }` |

---

## 12. Shim Architecture

`~/.ftr10/shim.js` — a generated IIFE loaded as `<script type="module">` in `workbench.html`.

### What it does (in order at load time)

1. **Injects CSS `<link>` tags** — resolves paths relative to `import.meta.url` so they work regardless of page URL
2. **Loads Thpace library** — `css.files/thpace.min.js` via dynamic `<script>`, then on `onload` fires `css.files/thpace-background.js`
3. **Applies baked-in defaults** — from values at shim generation time, to `:root { --ftr10-* }` with `!important`
4. **Starts adaptive polling of `vars.json`** — 30 s idle / 1.5 s burst (8 s window after change), cache-busting with `?t=Date.now()`
5. **On vars.json change** — diffs `lastModified`, applies new vars, calls `__applyEffect()`, toggles Thpace
6. **Listens on `BroadcastChannel('theme-sync')`** — receives `relayVars` messages from sidebar/editor webviews for immediate apply (no polling delay)

### `window.ftr10Thpace` API (exposed by `thpace-background.js`)

| Method | Description |
|---|---|
| `.isEnabled()` | Returns current on/off state |
| `.enable()` | Shows canvas, resumes animation |
| `.disable()` | Hides canvas, pauses animation |
| `.setOpacity(0–1)` | Sets canvas opacity, auto-persists to localStorage |
| `.refreshColors()` | Re-reads CSS var colors from computed style |
| `.updateSettings({ ... })` | Live-tweaks triangle size, colors, FPS, etc. |
| `.settings()` | Returns current settings object |

---

## 13. Preview Engine (crossnote) Style Path

The markdown preview engine uses a **separate write path** from theme-sync.

```
In-preview ThemeCustomizer UI
        │
        ▼  postMessage '_crossnote.writeUserStyle'
extension-common.ts  writeUserStyle(cssBlock)  [line 807]
        │
        └─ vscode.workspace.fs.writeFile(
               Uri.joinPath(context.globalStorageUri, 'user-style.css'),
               cssBlock
           )
           → NOT written to ~/.ftr10/style.less
           → Written to extension global storage directory
```

`~/.ftr10/style.less` is an **old crossnote user style file** — still present on disk from the pre-merge era, but no code in the current extension reads or writes it during theme operations.

---

## 14. Token Color System

### Flow

```
tokens.json (scope map with fallback hex colors)
        │
writeTokenColors(values)  reads file, substitutes via lookup tables:
        │
        ├─ TOKEN_NAME_MAP       maps token `name` → --ftr10-token-* key (80+ entries)
        └─ SEMANTIC_TOKEN_MAP   maps semantic token key → --ftr10-token-* key (19 entries)
                │
                ▼
     Writes to VS Code globalSettings:
     editor.tokenColorCustomizations     { textMateRules: [...] }
     editor.semanticTokenColorCustomizations { rules: {...}, enabled: true }
```

All token vars use 6-digit hex — Monaco does not support alpha in token colors. `toHex6()` helper strips alpha from any `#RRGGBBAA` value before writing.

---

## 15. P10k Terminal Integration

Every `persistThemeConfig()` call regenerates `~/.ftr10/terminal-colors.zsh`:

```zsh
# FTR10 terminal accent colors — auto-generated, do not edit manually
export FTR10_ACCENT1='#34e411'
export FTR10_ACCENT2='#9b59b6'
export FTR10_ACCENT3='#3498db'
```

After **Apply & Sync** or **applyPreset**, `sourceP10kInTerminals()` runs `source ~/.p10k.zsh` in every open terminal automatically. The **liveUpdate** debounce (2 s auto-save) does **NOT** trigger p10k sourcing.

---

## 16. Build & Install

```bash
# From /home/ftr/FTR10.Codex
bash install-extension.sh
```

Build sequence inside the script:
1. `cd crossnote && pnpm run build` — builds embedded crossnote (esbuild, outputs `crossnote/webview/preview.js`)
2. `cd .. && node build.js` — builds native + web extension bundles
3. Packages and installs into code-server

Do **NOT** edit anything in `out/`, `crossnote/out/`, or `crossnote/webview/preview.js` — these are build artifacts.

---

## 17. Legacy Notes

| Old reference | Current reality |
|---|---|
| `mpae.writeThemeVars` command | Does not exist in current source — historical only (in CHANGELOG) |
| `~/.ftr10/style.less` as write target | Not written by theme-sync — legacy crossnote user style |
| `--mpae-*` CSS vars | Renamed to `--ftr10-*` (all 1010 occurrences, April 2026) |
| Config dir `.crossnote` | Renamed to `.ftr10` (April 2026) |
| `code-server-theme-sync` extension | Merged into `FTR10 Codex` (`acester822.ftr10-codex`) |
| `media/logo.svg` as icon | Icon is now `media/logo.png` in `package.json` |
| Static preset cards in sidebar | **Removed from sidebar UI** (April 2026) — THEME_PRESETS[] still in code for reference; sidebar now shows only Architect session cards |

---

## 18. Architect Session System (added 2026-04-28)

The sidebar and Architect panel were rebuilt around a new first-class concept: **ArchitectSession** — a saved state of the Architect palette generator that becomes the source of truth for a theme card.

### Design intent

- **Architect is the centerpiece** — the sidebar no longer lists static presets as primary UI. Instead, sessions saved from the Architect appear as editable cards.
- **Derivation is pure and re-runnable** — `deriveCodexPreset(session)` is a standalone exported function. Given any `ArchitectSession`, it returns a full `ThemePreset` with all `--ftr10-*` overrides. This replaces the old one-shot `CodexApply` imperative block.
- **Static presets preserved but not wired** — `THEME_PRESETS[]` and all preset files in `src/theme-presets/` are untouched and remain in the codebase. They are not shown in the sidebar but are available for future use or reference.

### New types (`src/theme-sync.ts`)

```ts
interface ArchitectSession {
  id: string;              // short base-36 timestamp ID, e.g. "m5kz2"
  name: string;            // user-assigned, max 40 chars
  baseHue: number;         // 0–360, the selected hue on the wheel
  harmony: string;         // 'complementary' | 'triadic' | 'split' | 'analogous' | 'tetradic' | 'monochromatic'
  swatchOverrides: Record<string, string>;  // index→hex for any manually overridden swatches
  savedColors: string[];   // 6 hex colors [c1..c6] as derived/overridden
  varOverrides?: Record<string, string>;  // extra --ftr10-* vars edited in the Vars panel, stored as a DIFF vs. the palette-derived set (added 2026-07-14)
  createdAt: number;       // ms timestamp
  updatedAt: number;       // ms timestamp
}
```

`ThemeConfig` and `RawThemeJson` both now include `architectSessions: Record<string, ArchitectSession>`.

### theme.json additions

`architectSessions` is persisted as a top-level key alongside `presetCustomizations` and `presetBackgroundMode`. Existing installs receive `{}` on first load — no migration needed.

### Key functions

| Function | Location | Purpose |
|---|---|---|
| `deriveCodexPreset(session)` | `theme-sync.ts` ~line 168 | **Exported pure fn** — ArchitectSession → ThemePreset with full `--ftr10-*` overrides |
| `applyArchitectSession(sessionId)` | `theme-sync.ts` | Derives preset, upserts into THEME_PRESETS[], calls `applyPreset()`, syncs sidebar |
| `buildSessionCardsHtml(activePreset?)` | `theme-sync.ts` | Returns rendered HTML for all session cards, sorted by `updatedAt` desc |
| `createCodexPanel(context, sessionId?)` | `theme-sync.ts` | Now accepts optional `sessionId` — sends `loadSession` to webview if provided |

### Sidebar (`getSidebarHtml` / `ThemeSidebarProvider`)

The sidebar now renders:
1. **Architect entry card** (always at top) — clicking opens a blank new session in the Architect panel
2. **Session cards** (user-saved, sorted newest first) — each card has:
   - 3 color swatches
   - Session name + harmony label
   - Edit gear button → opens Architect pre-loaded with that session's state
   - Delete ✕ button → removes from `architectSessions`, re-renders cards
   - Bg-mode toggle (Effects / Solid) — works identically to old preset bg-mode
   - "Active" badge when this session's derived preset is active

New `ThemeSidebarProvider` methods:
- `syncSessions()` — pushes `syncSessions` message with re-rendered card HTML; called after any session CRUD
- Existing `syncActivePreset()` and `syncBgModes()` updated to use `arch-{id}` preset IDs from sessions

### Architect panel (webview)

New UI additions:
- **Session name input** — text field above the action row, default "Untitled", max 40 chars
- **Save button** (`⊛ Save`) — saves session state without applying; creates a new sidebar card
- **Apply button** (`⬡ Apply`) — saves session + derives + applies the preset (was previously Apply-only without saving)

New webview state variables: `currentSessionId`, `sessionName`

New messages the Architect **sends** to the extension:

| Message | Payload | Effect |
|---|---|---|
| `saveSession` | `{ sessionId, name, baseHue, harmony, swatchOverrides, colors, bgEffect, thpaceEnabled, vars }` | Saves/updates session in `architectSessions`, syncs sidebar, sends `sessionSaved` back. Extra Vars-panel edits in `vars` are diffed vs. the derived set and stored as `session.varOverrides` |
| `applySession` | same as above | Save + derive + apply + sync sidebar. `varOverrides` are re-asserted into `themeConfig.values` after `applyPreset` so extra-var edits survive |
| `CodexUpdate` | `{ colors }` | Live preview — updates swatch colors on the Architect entry card in sidebar |

New messages the Architect **receives** from the extension:

| Message | Payload | Effect |
|---|---|---|
| `loadSession` | `{ session: ArchitectSession }` | Restores full session state: hue, harmony, overrides, name input |
| `sessionSaved` | `{ sessionId, name }` | Updates `currentSessionId` so subsequent saves update the same card |

### Derived preset ID convention

Session IDs are short base-36 timestamps (e.g. `"m5kz2"`). Their derived `ThemePreset` id is always `arch-{sessionId}` (e.g. `"arch-m5kz2"`). This prefix makes them easily distinguishable from static preset IDs at a glance.

### Bg-mode storage

`presetBackgroundMode` in `theme.json` stores modes keyed by preset ID, so `arch-{id}` entries work identically to how static presets stored bg modes before.