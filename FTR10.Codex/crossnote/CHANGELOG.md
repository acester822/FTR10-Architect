# Changelog

Please visit https://github.com/shd101wyy/vscode-markdown-preview-enhanced/releases for the more changelog

## [Unreleased]

### Changed

- **CSS custom properties renamed from `--mpae-*` to `--ftr10-*`** (`styles/preview.less`, `styles/preview_theme/none.less`, `src/webview/components/ThemeCustomizer.tsx`): All 1010 occurrences of `--mpae-` CSS variable references renamed to `--ftr10-` across source files.

- **Config directory renamed from `.crossnote` to `.ftr10`** (`src/notebook/index.ts`, `src/webview/components/ThemeCustomizer.tsx`): Notebook config lookup now reads from `.ftr10/` inside the notebook path. ThemeCustomizer UI text updated to reflect `~/.ftr10/style.less`.

### Fixed

- `styles/preview_theme/none.less`: **Classic theme backgrounds restored.** Reverted global `body { background-color: transparent }` back to `background-color: @dark-bg`. The transparency is now scoped inside each of the 7 MPAE animated per-preset blocks (`html[data-mpae-theme="..."] body { background-color: transparent }`) so classic themes keep their solid background while particle/aurora effects remain visible.

- `styles/preview_theme/none.less`: **Aces Codepunk completely rewritten** to match the original standalone `aces-codepunk.css` design — large h1/h2/h3 with gradient `::after` underlines (`display: block; width: fit-content; position: relative`), h1 text-stroke + orange glow, h2 amber, h3 burnt orange, h4 green (`#00973c`), h5/h6 grey (`#9ba09d`), blockquote with no left bar + paragraph gradient line, plain solid grey HR (`4px`), grey-text links with `text-decoration: underline`, inline code dark background (`#303337`) + grey text (`#bababa`), and iconic dashed yellow code block borders (`2px dashed #c8b400`) for syntax-highlighted blocks. Particle field preserved.

### Added

- `styles/preview_theme/none.less`, `styles/preview.less`: **`--mpae-border-style` CSS var** (`solid` default) wired into inline code, table, `thead th`, `tbody td`, and blockquote border declarations so all main borders respond to the new Shape & Style selector.

- `styles/preview_theme/none.less`: **`--mpae-link-hover-shadow` and `--mpae-link-hover-transform` CSS vars** wired into base `a:hover` rule. Enables ThemeCustomizer hover effect presets (Plain / Glow / Lift / Pop) to control link hover behavior globally.

- `styles/preview_theme/none.less`: **`--mpae-bg-pattern-pos` CSS var** wired into `body { background-position }` for patterns that require offset positioning (Circuit, Crosses, Hexagons, Noise).

- `styles/preview.less`: **New web font imports** — DM Mono, Recursive, Oxanium, Exo 2, Silkscreen.

- `styles/preview.less`: **New CSS var defaults** — `--mpae-border-style: solid`, `--mpae-link-hover-shadow: none`, `--mpae-link-hover-transform: none`, `--mpae-bg-pattern-pos: 0 0`.

- `src/webview/components/ThemeCustomizer.tsx`: **5 new background pattern options** — Diagonal (45° repeating lines), Crosses (dot-grid offset), Circuit (grid + dots, offset positioned), Hexagons (tri-gradient hex grid), Noise (dual-scale radial grain). `BgPattern` interface extended with optional `pos` field for background-position.

- `src/webview/components/ThemeCustomizer.tsx`: **6 new fonts** added to `FONT_OPTIONS` — DM Mono, Recursive, Silkscreen, Oxanium, Exo 2 (now 15 options total).

- `src/webview/components/ThemeCustomizer.tsx`: **Randomizer moved to standalone full-width button** (🎲 Random 🎲) positioned between the Presets trigger and the Colors section. Randomizer now also picks a random border style and hover effect preset.

- `src/webview/components/ThemeCustomizer.tsx`: **Extra Background Effects made collapsible** (was always expanded). Toggle button with chevron matches other section headers.

- `src/webview/components/ThemeCustomizer.tsx`: **Border Style selector** added to Shape & Style — Solid / Dashed / Dotted / Double.

- `src/webview/components/ThemeCustomizer.tsx`: **Hover Effect selector** added to Shape & Style — Plain / Glow / Lift / Pop. Uses `HOVER_PRESETS` constant mapping key → `{ --mpae-link-hover-shadow, --mpae-link-hover-transform }` values applied directly to DOM and saved to localStorage.

- `src/webview/components/ThemeCustomizer.tsx`: **`applyHoverEffect` callback** and **`HOVER_PRESETS` constant** for managing link hover effect state. Hover effect key persisted in `mpae-hover-effect` localStorage key and restored on mount.

- `src/webview/components/ThemeCustomizer.tsx`: **`buildCSSBlock` extended** with `bgPos` parameter — saves `--mpae-bg-pattern-pos` in CSS output so circuit/hex/crosses/noise patterns re-apply correctly on next load.


- `src/webview/components/ThemeCustomizer.tsx`: **Randomize button** — "Rand" button (with rotate icon) in the Colors section header. Generates 3 vivid accent colours distributed 120° apart on the hue wheel, a random dark background, coherent surface/border derived from accent-1, randomised values for all 13 structural vars (radii scaled together for visual consistency, heading-transform / link-style weighted toward common choices), and re-derives all syntax tokens from the new accents.

- `src/webview/components/ThemeCustomizer.tsx`: **`SliderRow` component** — range input + numeric readout for pixel-valued CSS vars.

- `src/webview/components/ThemeCustomizer.tsx`: **`SelectRow` component** — labelled `<select>` for discrete CSS property values.

### Changed

- `src/webview/components/ThemeCustomizer.tsx`: **All 16 presets** (7 MPAE Custom + 9 Classic) given distinct values for the 13 new structural vars. Key personality differences: Popover Universe = `3px` sharp corners + uppercase headings + dashed links; Midnight Ocean = `18–22px` pill corners; Emerald Forest = `4px` code blocks with `4px` blockquote left border; Monochrome = `4px` sharp + uppercase + dotted links; Aces Codepunk = `0px` corners throughout; classic light themes fixed for appropriate dark strong-color on light backgrounds.

- `src/webview/components/ThemeCustomizer.tsx`: **`--mpae-strong-color` values in 9 classic presets converted from `rgba()` to hex** — so the ColorRow colour picker can display and edit them correctly (was showing fallback grey `#808080`).

 — `--mpae-radius-block`, `--mpae-radius-quote`, `--mpae-radius-inline`, `--mpae-radius-img`, `--mpae-heading-transform`, `--mpae-heading-spacing`, `--mpae-strong-color`, `--mpae-em-color`, `--mpae-mark-bg`, `--mpae-mark-color`, `--mpae-link-style`, `--mpae-surface-hover`, `--mpae-blockquote-width` — enabling per-preset control over border radii, heading text-transform/letter-spacing, emphasis element colours, highlight element colours, link underline style, table row hover colour, and blockquote border thickness.

- `styles/preview_theme/none.less` base layer: **All 13 new vars wired into markdown element selectors.** `pre` border-radius now uses `--mpae-radius-block`; `blockquote` border-left-width uses `--mpae-blockquote-width` and right-side radius uses `--mpae-radius-quote`; inline `code` uses `--mpae-radius-inline`; `img` uses `--mpae-radius-img`; headings use `--mpae-heading-transform` and `--mpae-heading-spacing`; `strong` uses `--mpae-strong-color`; `em` uses `--mpae-em-color`; `mark` uses `--mpae-mark-bg` and `--mpae-mark-color`; `a` border-bottom-style uses `--mpae-link-style`; table row hover uses `--mpae-surface-hover`.

- `styles/preview_theme/none.less`: **Aces Codepunk per-preset CSS block** (`html[data-mpae-theme="aces-codepunk"]`) — tri-colour neon particle field (orange/lime/magenta), dim punk atmosphere behind content, heading colours matched to preset accents with h1 text-shadow, zero border-radius on all elements (sharp brutalist edges), themed code/blockquote/table/image/a/mark/strong/em overrides, gradient scrollbar, topbar with square corners.

- `src/webview/components/ThemeCustomizer.tsx`: **All 16 presets** (7 MPAE Custom + 9 Classic) given distinct values for the 13 new structural vars. Key personality differences: Popover Universe = `3px` sharp corners + uppercase headings + dashed links; Midnight Ocean = `18–22px` pill corners; Emerald Forest = `4px` code blocks with `4px` blockquote left border; Monochrome = `4px` sharp + uppercase + dotted links; Aces Codepunk = `0px` corners throughout; classic light themes fixed (strong was `#ffffff` on light bg — now uses theme-appropriate dark colour via `--mpae-strong-color`). 



- `src/markdown-engine/index.ts`: **Removed inline `<style>` block injected into preview HTML** that set `html, body { background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }` and `pre code { color: var(--vscode-editor-foreground); }`. This block was guarded by `previewTheme === 'none.css'` and was overriding the MPAE theme colors — background and text color set via `--mpae-bg` and `--mpae-text` in `none.less` and `ThemeCustomizer`. The MPAE CSS vars now own these values exclusively.

### Added

- `src/webview/components/ThemeCustomizer.tsx`: **Aces Codepunk preset** added to the "MPAE Custom" section of the preset panel. Colors extracted directly from `aces-codepunk.css`: bg `#1d1f21`, primary `#f5704d` (orange), secondary `#a8ff60` (lime), tertiary `#ff73fd` (magenta), token set matches original Prism theme (keyword amber, string lime, function `#ff0088`, number magenta, property/class-name `#ffdc01`, tag/selector `#96cbfe`).

### Changed

- `src/webview/components/ThemeCustomizer.tsx`: **Classic presets no longer display accent-coloured code and blockquote borders.** Root cause: `applyVarsToDOM` and `buildCSSBlock` always computed `--mpae-code-border-l/r` and `--mpae-blockquote-border` from the accent colors, overwriting any value the preset had already placed in `vars`. Fixed by making those assignments conditional: they only fire when the key is absent from the preset's `vars` object. All 9 classic presets now supply `'--mpae-code-border-l': 'var(--mpae-border)'`, `'--mpae-code-border-r': 'var(--mpae-border)'`, and `'--mpae-blockquote-border': 'var(--mpae-border)'` so their code blocks and blockquotes use the subtle per-theme border color instead of bright accent glows.

- `styles/preview.less` + `src/webview/components/ThemeCustomizer.tsx`: **Tertiary color now visibly affects the HR divider gradient.**** Root cause: `--mpae-hr-gradient` was computed as `linear-gradient(90deg, transparent, a1, a2, a1, transparent)` — `a3` (tertiary) was missing and the last stop repeated `a1`. Since `preview.less` defines `html body hr { background: var(--mpae-hr-gradient) }` with higher specificity (0,0,0,3) than `none.css`'s `hr` rule (0,0,0,1), the HR always showed the old gradient. Fixed in three places: `applyVarsToDOM` live gradient computation, `buildCSSBlock` saved CSS gradient, and `:root` default in `preview.less`.
- `styles/preview.less` + `styles/preview_theme/none.less` + `src/webview/components/ThemeCustomizer.tsx`: **Font system overhauled — eliminated 6–7 competing font-family declarations.** Root causes: (1) `preview.less` had `html, body { font-family: 'Victor Mono', monospace !important }` which overrode all CSS-var-based font assignments; (2) per-theme blocks in `none.less` (e.g. `html[data-mpae-theme=popover-universe] body { font-family: Rajdhani... }`) set `font-family` directly, bypassing the `var(--mpae-body-font, ...)` mechanism on the base rules; (3) presets were missing `--mpae-code-font` so code font changes had no effect. Fixes: removed `!important` from `preview.less` body rule and replaced with `var(--mpae-body-font, 'Victor Mono', monospace)`; added `--mpae-code-font` to `:root` defaults in `preview.less`; removed all 11 direct `font-family` declarations from the 6 per-theme blocks in `none.less` (letter-spacing, font-weight, text-transform retained); added `--mpae-code-font` to all 15 presets (6 MPAE + 9 classic) in `ThemeCustomizer.tsx`; moved font `@import` URLs from `none.less` to `preview.less` so fonts are always available regardless of active theme.
- `src/webview/components/ThemeCustomizer.tsx`: **Font selection dropdowns now show the active preset's actual font name.** "Theme Default" was an opaque label giving no information about which font would be applied. Added `firstFontName(stack)` helper that extracts the primary family name from a CSS font-family stack string. `FontRow` now takes a `themeFont` prop (the preset's CSS font-family value) and uses it to synthesise a dynamic first-option label like "Theme (Orbitron)" or "Theme (Space Grotesk)". The three `<FontRow>` elements in the JSX now pass `themeFont={vars['--mpae-heading-font']}`, `themeFont={vars['--mpae-body-font']}`, and `themeFont={vars['--mpae-code-font']}` respectively.
- `src/webview/components/ThemeCustomizer.tsx`: **Font overrides now persist through color changes.** Root cause: `applyVarsToDOM()` inside `updateVar` was re-applying the preset's font CSS vars on every color change, wiping any user font override. Fix: after `applyVarsToDOM`, immediately re-apply any active font overrides from a `useRef` that is always kept in sync with the `fontOverrides` state. The `useRef` avoids stale closure issues in the `setVars` functional updater.
- `src/webview/components/ThemeCustomizer.tsx`: **Background pattern now restores on panel reopen.** Root cause: `bgPatternId` state was always initialised to `'none'` on mount; a subsequent Save would overwrite the saved CSS with `--mpae-bg-pattern: none`. Fix: `applyBgPattern` now writes `bgPatternId` to `localStorage['mpae-bg-pattern']`; the mount `useEffect` restores it (re-computing the correct pattern CSS from the saved accent colour) and re-applies it to the DOM.
- `src/webview/components/ThemeCustomizer.tsx`: **Font overrides restore on preset switch and page reload.** `handleSave` writes `fontOverrides` per-preset to `localStorage['mpae-fo-${presetId}']`. `applyPreset` and the mount `useEffect` read this key and re-apply saved overrides whenever a preset is activated. Switching away from a preset that has no saved overrides resets the Font dropdowns to "Theme Default".

### Changed

- `src/webview/components/ThemeCustomizer.tsx`: **Theme-scoped style.less output.** The saved CSS block now uses `html[data-mpae-theme="<id>"] { }` as the selector for named presets (fallback to `:root { }` for the "custom" mode). Multiple presets can be saved independently — each `handleSave` reads all previously saved blocks from `localStorage['mpae-theme-blocks']`, updates the current preset's block, and writes the combined set to `style.less` wrapped in the existing `/* === MPAE Theme Generator === */` markers. `handleClear` removes only the current preset's block; the style.less is rewritten from the remaining blocks (or emptied if no blocks remain). This allows per-theme syntax colour and font customisation that does not bleed into other themes.
- `src/webview/components/ThemeCustomizer.tsx`: Extracted `assembleStyleFile(blocks)` helper — wraps multiple per-theme CSS blocks in the `/* === MPAE Theme Generator === */` markers and joins them.
- `src/webview/components/ThemeCustomizer.tsx`: Added `useRef` to React import.

### Added

- `src/webview/components/ThemeCustomizer.tsx` **(v2 rewrite)**: Architecture change from color-only presets to full per-preset visual identity system. Each of the 6 presets now also sets `html[data-mpae-theme="id"]` via `document.documentElement.setAttribute()` so unique CSS blocks in `none.less` can activate theme-specific backgrounds, animations, heading fonts, and effects. Active preset persisted to `localStorage` under `mpae-theme-id` and restored on component mount. Per-preset `--mpae-body-font`, `--mpae-heading-font`, `--mpae-code-scanline` vars applied alongside color vars. Added `deriveTokens()` helper — converts 3 seed hex colors (Primary, Secondary, Tertiary) into 9 syntax token colors via HSL hue-shifts, so changing accent colors auto-updates the whole token palette. Advanced "Syntax Tokens" section now shows token colors derived from seeds (individually editable via collapse disclosure). `buildCSSBlock()` now emits `--mpae-theme-id` and all font/scanline vars so the saved style.less fully restores the theme.
- `styles/preview_theme/none.less`: Added animated particle field + rotating atmosphere backgrounds to all 5 remaining themes, matching the Popover Universe approach (`body::before` = tiled particle dots with `mpae-twinkle`, `body::after` = oversized rotating colour blobs with `mpae-aurora`):
  - **Dark Material**: 18 cyan/violet/rose tech-node dots (1000×450 tile, 9s twinkle) + 4-ellipse material depth planes rotating at 24s.
  - **Midnight Ocean**: 20 bioluminescent blue/cyan/violet orbs (900×500 tile, 7s twinkle) + 5-ellipse deep-ocean glow banks rotating at 20s; replaces old static 4-ellipse aurora + static bottom wave.
  - **Emerald Forest**: 18 lime/green/gold firefly dots (1100×550 tile, 5s twinkle); existing animated conic-gradient canopy `::after` retained.
  - **Solar Flare**: 18 amber/gold/pink ember particles (950×500 tile, 3.5s twinkle — fastest = most energetic) + 4-ellipse rotating solar corona at 16s; replaces old 3-ellipse lava + static bottom corona.
  - **Monochrome**: 20 white phosphor-persistence dots (800×400 tile, 4s twinkle) replacing the static CRT scanline `::before`; existing moving scanline sweep `::after` retained.
  - `popover-universe`: 22-point star field radial gradient on `body::before`, 4-layer nebula glow with `mpae-nebula` rotation animation on `body::after`, Orbitron heading font, gradient-clip h1 with `mpae-glow-pulse`, gradient h2 with drop-shadow, colored h3–h6 with text-shadow, animated blockquote border glow, neon scrollbar + topbar.
  - `dark-material`: Minimal — card-like `pre` box-shadow, material-tinted blockquote, gradient table header, clean link hover.
  - `midnight-ocean`: Wide aurora radial-gradient `body::before` with `mpae-aurora` animation, Space Grotesk headings, animated gradient-clip h1 (`mpae-float`), frosted-glass blockquote.
  - `emerald-forest`: Organic radial-gradient depth + conic-gradient canopy rays (`mpae-ember`), Space Grotesk headings, gold→green gradient h1, bark-style `pre` with emerald scanline.
  - `solar-flare`: Lava glow radial-gradient `body::before` with `mpae-ember` animation, solar corona gradient at bottom, Space Grotesk headings, fire gradient-clip h1 with animation, amber scanline.
  - `monochrome`: Static CRT scanline texture on `body::before` (repeating-linear-gradient), moving scanline sweep element on `body::after` (`mpae-crt-scan`), Fira Code throughout, all-caps tracked headings, blinking terminal cursor `_` appended to h1 via `::after`, clinical grey palette.
- `styles/preview_theme/none.less`: Shared `@keyframes` block added: `mpae-twinkle`, `mpae-nebula`, `mpae-glow-pulse`, `mpae-border-glow`, `mpae-float`, `mpae-ripple-h`, `mpae-aurora`, `mpae-ember`, `mpae-mono-scan`, `mpae-crt-scan`.

### Changed
- `src/webview/components/ThemeCustomizer.tsx`: Major UX overhaul:
  - **Classic theme presets**: Added 9 presets derived from the legacy preview themes — Monokai, Night, One Dark, GitHub Dark, GitHub Light, Atom Material, Solarized Dark, Solarized Light, Vue — each with accurate token colours. Combined with original 6 MPAE presets via `ALL_PRESETS`.
  - **Nested presets popover**: The preset grid is now hidden behind a trigger button (shows current preset swatch + name + chevron). Clicking opens a full-height slide-in popover panel to the left of the customiser (380 px, position:fixed, z-index 10000) with two sections — "MPAE Custom" and "Classic Themes" — in a 3-column card grid. A transparent backdrop (z-index 9998) closes the popover on outside clicks. Fragment return wraps both the panel and popover as siblings, escaping the `backdropFilter` stacking context.
  - **Colors collapsible**: The Colors section now uses the same toggle-button pattern as Syntax Tokens, with a chevron and `showColors` state defaulting to open.
  - **Clear button**: Footer now has two equal-width buttons — "Save" (existing logic, writes CSS block to style.less) and "Clear" (calls `postMessage('writeUserStyle', [''])` which removes the MPAE block from style.less). Both show a 2-second feedback indicator.
- `styles/preview_theme/none.less`: Significantly boosted particle and atmosphere opacity across all 5 animated themes — particle dots now 0.65–0.95 (were 0.08–0.45), atmosphere ellipses now 0.18–0.35 (were 0.06–0.15). Emerald Forest conic canopy `::after` gradients also boosted from 0.04–0.06 to 0.14–0.22. Makes all particle fields clearly visible against the solid body background.
- `styles/preview_theme/none.less`: Replaced single Google Fonts `@import` with two imports. Victor Mono added via Bunny Fonts CDN (`fonts.bunny.net`) as it is not available on Google Fonts. JetBrains Mono added to the existing Google Fonts URL alongside Orbitron, Rajdhani, Space Grotesk, and Fira Code.

### Fixed

- `src/webview/components/ThemeCustomizer.tsx`: Removed unused `useRef` import (TS6133 error).
- `styles/preview_theme/none.less`: Fixed typo `rgba(0. 255, 136, 0.45)` → `rgba(0, 255, 136, 0.45)` in Popover Universe h4 rule (LESS parse error at line 613).

### Fixed

- `src/webview/components/InlineEditor.tsx`, `styles/preview.less`: **Inline editor bottom-anchor retool.** Removed the `[rect, value]` scroll effect that was creating a feedback loop (scroll → setRect → re-render → re-scroll) making the editor glitch as content grew. The overlay is now `position:fixed; bottom:16px` — it grows upward with content and never clips below the viewport. A single one-time `requestAnimationFrame` scroll on open nudges the page up so the target element stays visible above the editor area. Textarea gains `max-height: 48vh` + `overflow-y: auto` for internal scrolling when content is very long. Removed `document.body.style.paddingBottom` manipulation (no longer needed).

- `src/extension-common.ts` (via mpae): See mpae CHANGELOG — save fix via `WorkspaceEdit` applies here too (crossnote bundle is `preview.js`; the extension-side fix is in mpae).


  - *ESC opens outline fixed*: Added `e.stopPropagation()` to the Escape `handleKeyDown` handler. The keydown was bubbling up to the document-level ESC handler in `preview.ts` (which toggles the sidebar TOC), causing the outline to open on every save.
  - *Save stale closure fixed*: Added `valueRef` that mirrors `value` state but is updated synchronously in `onChange` (before React re-renders). `commit()` now reads `valueRef.current` instead of the `value` closure, so it always has the latest textarea content regardless of React render timing. `valueRef` is also initialized from the same `initial` string on editor open. The live-preview effect captures `valueRef.current` into a local `snapshot` variable at effect call time to avoid closure drift inside the `setTimeout`.
  - *Scroll broken fixed*: Removed `getScrollParent` entirely. The previous approach found `.crossnote[data-for='preview']` (which has `overflow: auto` in CSS) but this element has `height: auto` so it never clips — `scrollBy` on it was a no-op. Now uses `document.scrollingElement || document.documentElement` (the actual VS Code webview scroll root). Padding is applied to `document.body`. Scroll uses `scrollTop +=` (instant, not smooth) so `inlineEditElement.getBoundingClientRect()` can be re-read immediately after and `setRect` called to reposition the fixed overlay. Used `requestAnimationFrame` instead of `setTimeout(30)` for correct timing.

- `src/webview/components/InlineEditor.tsx`: **Inline editor fix — save race, cursor capture, scroll container (previous)**
  - *Save race fixed*: Added `liveTimerRef` to track the 350 ms live-preview debounce. `commit()` now cancels the pending timer before doing its own final `postMessage`, eliminating the double-send race that was causing the save to produce corrupted/unexpected output. Backdrop click and Escape still always commit.
  - *Enter key is now a normal newline*: Removed the `Enter→commit` shortcut. The `handleKeyDown` handler now only intercepts Escape; Enter (and Shift+Enter) fall through to the browser's default textarea `\n` insertion. Hint text updated accordingly.
  - *Cursor auto-capture fixed*: Changed `.focus()` from a synchronous `useEffect` call to `setTimeout(..., 80 ms)`. The synchronous call was firing before the double-click's `mouseup` event, which stole focus back to the document. The 80 ms delay ensures focus lands in the textarea after the click sequence completes.
  - *Scroll fix*: Added `getScrollParent()` helper that walks the DOM to find the nearest `overflow: auto/scroll` ancestor. Both the "ensure scroll room" effect (previously `document.body` spacer → now `container.style.paddingBottom = '60vh'`) and the scroll-into-view effect now target the actual preview scroll container instead of `window`. This fixes the case where `window.scrollBy` had no effect because the preview content scrolls inside `.crossnote[data-for="preview"]`, not the window.

- `src/webview/components/InlineEditor.tsx`: **Save on close, live preview, bottom-spacer (previous)**
  - *Save on close*: Backdrop click (`onClick`) and Escape key now both call `commit()` instead of `close()`, so every dismissal path saves changes. Updated hint bar text to reflect this.
  - *Live preview*: Added a `useEffect([value])` with a 350 ms debounce that splices the current textarea value into `workingMarkdownRef` and calls `postMessage('updateMarkdown', ...)` as the user types, so the rendered preview updates in real time. An `isDirtyRef` guards against firing on the initial value load. `workingMarkdownRef` (a local snapshot taken at editor-open time) and `lineRangeRef` (which tracks the current `[start, end]` line range including line-count changes from prior live updates) eliminate races against the container's `markdown` state.
  - *Bottom spacer / scroll fix*: Added `useEffect([inlineEditElement])` that appends a `60vh` invisible spacer div (`#inline-editor-spacer`) to `document.body` while the editor is open, giving the browser enough document height to scroll the editor fully into view even when the target element is the last item on the page. The spacer is removed on close. Changed scroll `useEffect` deps from `[rect]` to `[rect, value]` so the scroll re-runs whenever the textarea grows.

- `src/webview/components/InlineEditor.tsx`: **Context menu compact size** Reduced `--contexify-menu-minWidth` from 240px → 160px, padding 8px → 4px, item content padding `8px 14px` → `4px 8px`, radius 18px → 10px, active-item radius 10px → 6px, separator margin 6px → 3px. Added `font-size: 11px !important` to `.contexify` rule so all menu text scales down proportionally.
- `styles/preview_theme/none.less`: Updated duplicate `--contexify-*` size vars to match the new compact values. Added `font-size: 11px !important` to `.contexify` none-theme rule.
- `styles/preview.less`: **Inline editor glass morphism.** Added `backdrop-filter: blur(20px)` and `-webkit-backdrop-filter` to `.inline-editor-overlay`. Changed textarea background from opaque `#1e1e1e` to `rgba(7,7,22,0.72)` and hint bar from `rgba(7,7,26,0.97)` to `rgba(7,7,26,0.75)` so content behind the editor shows through with a frosted-glass effect.
- `src/webview/components/InlineEditor.tsx`: **Inline editor placement below element.** Editor overlay now positions at `top: rect.bottom + 8` (just below the target element) instead of `top: rect.top` (over it). Removed the `visibility: hidden` call that was hiding the element being edited — the element is now fully visible while its source is being edited in the box below. Removed the corresponding visibility-restore cleanup effect. Added `overlayRef` and a new `useEffect([rect])` that calls `window.scrollBy({ top: overflow, behavior: 'smooth' })` if the editor box would extend below the viewport bottom, ensuring it's always fully visible regardless of where the target element sits on the page.

- `styles/preview.less`: **Global UI chrome — Popover Universe neon redesign.** Gooey FAB blobs changed from amber `#eab308` to dark neon (`#07071a` bg, `#00f5ff` icons, cyan fill on hover). Monaco line decoration changed from green to neon cyan. Line-number gutter border/text changed from yellow to neon cyan. `<hr>` gradient changed from warm orange to neon blue→purple. "End of document" final-line text changed to neon cyan with Orbitron font and subtle glow. Inline editor border changed from VS Code blue to neon cyan. Added global `--contexify-*` CSS variable block so the context menu always shows as a dark glass neon panel. Added `.footer>div` neon glass panel (dark bg, neon `border-top`, `backdrop-filter: blur(24px)`). Added `.topbar>div` glass panel globally. Added `.code-chunk-btn-group` neon glass button styling. Added `dialog.modal::backdrop` dark blur + `.modal-box` dark glass neon frame (ImageHelper modal), including drop-zone, input and button overrides.
- `src/webview/components/FloatingActions.tsx`: Changed `gooey-copy-flash` keyframe outline from amber `rgba(234,179,8,…)` to neon cyan `rgba(0,245,255,…)` to match the new FAB palette.
- `styles/preview_theme/none.less`: Replaced incorrect `.floating-action>div>button` selector (class never exists in the component DOM) with correct `.gooey-item,.gooey-toggle` selectors reinforcing neon icon colour and hover state. Added `.footer>div` neon glass override for the none theme.

- `styles/preview_theme/none.less`: Full Popover Universe-inspired theme for the "none" preview theme. Includes an animated star-field background (`body::before`), nebula glow layer (`body::after`), Orbitron/Rajdhani Google Font imports, neon gradient headings (h1–h6 each get a distinct neon color with text-shadow/drop-shadow animations), glass-morphism blockquotes and code blocks (gradient border via mask technique, `backdrop-filter: blur`), neon list markers, neon link styling with hover glow, neon table headers, DaisyUI palette overrides (`--p`, `--s`, `--a`, `--b1-b3`, `--bc`) wired to the neon palette, `react-contexify` context menu CSS variable overrides for a dark glass neon menu, topbar glass-blur panel styling, neon scrollbar styling, floating action button neon halo, and sidebar ToC neon link highlights.

- `src/webview/containers/preview.ts`: Gated the ESC keydown handler (`onKeydownEventHandler`) so it only calls `escPressed` (sidebar TOC toggle) when `inlineEditElement` is `null`. When the inline editor is open, the document-level ESC press is suppressed and the textarea's own `onKeyDown` handler closes the editor cleanly. Added `inlineEditElement` to `onKeydownEventHandler` dep array.
- `src/webview/containers/preview.ts`: Added `dblclick` listener in `bindHighlightEvent` loop alongside the existing `mouseover`/`mouseout` listeners. Double-clicking any `[data-source-line]` element calls `setInlineEditElement(firstHighlightElement)`, opening the inline editor directly without needing the FloatingActions menu.
- `src/webview/components/InlineEditor.tsx`: New component — inline block editor. When activated via the FloatingActions "Edit in place" button, renders a fixed-position `<textarea>` directly over the hovered element, pre-filled with the raw markdown source lines for that block (via `getHighlightElementLineRange` + `markdown`). Enter = write+close, Shift+Enter = newline, Escape = cancel, backdrop click = cancel. On confirm, splices the edited lines back into the full markdown string and calls `postMessage('updateMarkdown', ...)`. The original element is hidden (`visibility: hidden`) while the editor is open and restored on close. Textarea auto-resizes to content height via `scrollHeight` assignment.
- `src/webview/containers/preview.ts`: Added `inlineEditElement: HTMLElement | null` state and `setInlineEditElement` setter; both exported from the container.
- `src/webview/components/FloatingActions.tsx`: Added `mdiPencilOutline` import. Added `setInlineEditElement` and `inlineEditElement` to container destructure. Added "Edit in place" menu item (first in the fan). Added `if (inlineEditElement) return null` guard to hide the fan while an inline edit is in progress. Updated `menuItems` `useMemo` dep array.
- `src/webview/components/Preview.tsx`: Added `InlineEditor` import and `<InlineEditor>` render.
- `styles/preview.less`: Added `.inline-editor-backdrop`, `.inline-editor-overlay`, `.inline-editor-textarea`, `.inline-editor-hint` styles.
- `src/webview/components/MonacoUnderlay.tsx`: Removed full-viewport `div.monaco-click-interceptor` and `handleInterceptorClick` callback. The interceptor was at z-index 5 and blocked all direct pointer events from reaching Monaco (z-index 3), preventing cursor placement by clicking. With the interceptor gone, `pointer-events: none` on the preview ghost (z-4) lets clicks fall through to Monaco natively — cursor position from clicking is now pixel-accurate.
- `src/webview/components/FloatingActions.tsx`: Added `isUnderlayMode` to destructured container values. Added `if (isUnderlayMode) return null` guard after `if (!activeEl) return null`. In underlay mode the preview ghost has `pointer-events: none`, inherited by all its children, so `mouseover`/`mouseout` listeners attached by `bindHighlightEvent` never fire and `highlightElement` is never set. Hiding FloatingActions explicitly prevents a confusing half-present state where the icon briefly appears (from hover state set before entering underlay mode) but immediately becomes unreachable.
- `styles/preview.less`: Removed `.monaco-click-interceptor` CSS block.
- `src/webview/components/MonacoUnderlay.tsx`: Added bidirectional cursor/scroll sync. (1) Monaco cursor → preview ghost scroll: `onDidChangeCursorPosition` with 80 ms debounce finds the preview element whose `data-source-line` is closest (floor) to the cursor line and calls `scrollIntoView({ block: 'nearest' })` on the preview container. (2) Preview click → Monaco cursor jump: a transparent `div.monaco-click-interceptor` (z-index 5, `cursor: text`) sits above the preview ghost; on click it uses `document.elementsFromPoint` to find the deepest preview descendant with a `data-source-line` attribute, converts it to a Monaco 1-based line number, and calls `editor.setPosition` + `editor.revealLineInCenter`.
- `styles/preview.less`: Added `.monaco-click-interceptor` rule (`position: fixed; z-index: 5; cursor: text; background: transparent`).
- `src/webview/components/MonacoUnderlay.tsx`: Added `scrollPreviewToLine` and `handleInterceptorClick` callbacks; updated `handleMount` deps; added `cursorSyncTimerRef` cleanup on unmount.
- `src/webview/components/MonacoUnderlay.tsx`: New component — Monaco Editor rendered as a full-viewport transparent layer behind the preview. Activated via `isUnderlayMode`; unmounts on deactivation (flushing any pending auto-save first). Uses `@monaco-editor/react` with `defaultValue={markdown}` so the editor always starts from the current file content. Changes are auto-saved with a 600 ms debounce via `postMessage('updateMarkdown', ...)`. Supports `vs-dark` / `vs` themes matching the preview theme.
- `src/webview/containers/preview.ts`: Added `isUnderlayMode` boolean state and `toggleUnderlayMode` callback. Toggling adds/removes the `body.underlay-mode` CSS class. Cleanup effect removes the class on unmount. Both exported from the container.
- `src/webview/components/Topbar.tsx`: Added `EyeIcon` / `PencilSquareIcon` imports. Added Monaco edit-mode toggle button (between collapse-all and TOC buttons) — shows `PencilSquareIcon` when in preview mode and `EyeIcon` when in underlay edit mode. Button is highlighted with `text-primary` during active edit mode.
- `src/webview/components/Preview.tsx`: Added `MonacoUnderlay` import and `<MonacoUnderlay>` render alongside `<FloatingActions>`.
- `styles/preview.less`: Added `.monaco-underlay-container` (fixed, full-viewport, `z-index: 3`). Added `body.underlay-mode` overrides — hides scrollbar, fixes preview element to full-viewport with `opacity: 0.12` and `pointer-events: none` at `z-index: 4` so Monaco receives all input.
- `src/webview/containers/preview.ts`: Added `setupSectionCollapse()` — post-processes each `h1`–`h6` in the live preview DOM, wrapping following sibling elements (up to the next same/higher-level heading) in a `div.md-section-body`, and injecting a `button.md-collapse-btn` as the first child of each heading. Collapse state per section is read/written to `localStorage` keyed by source URI + heading tag + source line. Called from `initEvents()` after each render pass.
- `src/webview/containers/preview.ts`: Added `collapseAllSections()`, `expandAllSections()`, and `toggleAllSections()` callbacks. Added `allSectionsCollapsed` boolean state (defaults `false`, resets on preview refresh). Both `allSectionsCollapsed` and `toggleAllSections` are exported from the container.
- `src/webview/components/Topbar.tsx`: Added `ArrowsPointingInIcon` / `ArrowsPointingOutIcon` imports. Added a new topbar button between Refresh and Table-of-contents that calls `toggleAllSections` and swaps its icon based on `allSectionsCollapsed`.
- `styles/preview.less`: Added `.md-collapse-btn` styles (opacity, transition, `::before` chevron character that rotates 90° when `.md-collapse-btn--collapsed`). Added `.md-section-body.md-collapsed { display: none; }`.

### Removed

- `src/webview/components/MarkdownEditor.tsx`: Deleted entire file — in-preview markdown editor feature removed.
- `src/webview/components/Preview.tsx`: Removed `MarkdownEditor` import, `enablePreviewZenMode` and `highlightElementBeingEdited` destructuring, and zen-mode-gated JSX for `FloatingActions` and `MarkdownEditor`. `FloatingActions` now always rendered.
- `src/webview/components/Footer.tsx`: Removed `enablePreviewZenMode` destructuring; footer always uses `justify-between` and always shows reading time.
- `src/webview/components/ContextMenu.tsx`: Removed `enablePreviewZenMode`, `highlightElementBeingEdited`, `setHighlightElementBeingEdited`, `setMarkdownEditorExpanded`, `isPresentationMode` destructuring; removed `mdiSpaOutline` import; removed `toggle-zen-mode` case; replaced "Edit Markdown" submenu (with "Open In-preview Editor") with a single "Open VS Code/External Editor" item; removed "Zen Mode" menu item and adjacent separator.
- `src/webview/components/FloatingActions.tsx`: Removed `highlightElementBeingEdited`/`setHighlightElementBeingEdited` destructuring; removed `mdiPencil` import; removed "Edit Markdown" action from `menuItems`; simplified guard from `!activeEl || !!highlightElementBeingEdited` to `!activeEl`.
- `src/webview/containers/preview.ts`: Removed `highlightElementBeingEdited`/`markdownEditorExpanded` state; removed `enablePreviewZenMode` useMemo; removed zen-mode guard from `bindHighlightEvent` (dep array `[]`); removed `zen-mode` class from `updateHtml` class string and deps; removed `highlightElementBeingEdited` useEffect; removed all five zen/editor fields from return object.
- `src/notebook/types.ts`: Removed `enablePreviewZenMode: boolean` type field and `enablePreviewZenMode: true` default value.
- `styles/preview.less`: Removed `.highlight-element-being-edited` CSS block.

### Changed
- `src/webview/components/FloatingActions.tsx`: Clamp `menuLeft` to `window.innerWidth - ITEM_SPACING - TOGGLE_SIZE - HOT_PAD - 4` so the fan never clips off-screen on wide elements. Replaced separate backdrop div + per-button `onMouseLeave` with a single persistent "hot zone" div: collapsed it covers just the toggle (28×28), open it expands to cover the full fan bounding box. Hot zone owns all `onMouseEnter/onMouseLeave` — entering cancels pending close, leaving schedules it. This fixes the bug where moving left/down from the toggle entered the old backdrop and cancelled the close.
- `styles/preview.less`: Flipped `.gooey-menu`, `.gooey-item`, `.gooey-toggle`, and `.gooey-tooltip` from `right: 0` to `left: 0` to match new left-anchored positioning.

## [0.9.20] - 2026-03-22

### Security

- Fix RCE vulnerability in `.crossnote/parser.js` hooks, by @0079522-Z461.

### Updates

- Update `sval` javascript interpreter to the latest `0.6.9`.

## [0.9.19] - 2026-03-15

### Bug fixes

- Fix sanitizer for mermaid and wavedrom diagrams.
- Fix `code_block=true` not preventing mermaid diagram rendering.
- Fix "Open in Browser" file paths on WSL.

## [0.9.18] - 2026-03-15

### Bug fixes

- Fix callout block rendering in file export

## [0.9.17] - 2026-03-15

### New features

- Add markdown-it callout feature with styling https://github.com/shd101wyy/crossnote/pull/387 by [@EmmetZ](https://github.com/EmmetZ).
- Add WebSequenceDiagrams support in `wsd` code blocks https://github.com/shd101wyy/vscode-markdown-preview-enhanced/pull/2228 by [@smhanov](https://github.com/smhanov).

### Bug fixes

- Remove the wrapper of custom head in HTML page https://github.com/shd101wyy/crossnote/pull/386 by [@TanShun](https://github.com/TanShun).

### Security

- Fix CVE-2025-65716: Sanitize rendered HTML to prevent arbitrary JavaScript execution via malicious markdown files. Added two-layer defense: server-side sanitization using cheerio (strips `<script>`, `<object>`, `<embed>`, `<applet>` tags, `on*` event handlers, dangerous URL schemes, and sandboxes all `<iframe>` elements) and client-side sanitization using DOMPurify as defense-in-depth at all `innerHTML` injection points https://github.com/shd101wyy/crossnote/pull/394

### Updates

- Update `mermaid` version to the latest `11.13.0`.
- Update `katex` version to the latest `0.16.38`.

## [0.9.16] - 2025-11-01

### Updates

- Update `mermaid` version to the latest `11.12.1`.
- Update `katex` version to the latest `0.16.25`.

### Changes

- Improve Prettier and CI config [PR#383](https://github.com/shd101wyy/crossnote/pull/383) by [kachkaev](https://github.com/kachkaev).
- Replace `yarn` with `pnpm` for package management and scripts.

## [0.9.15] - 2025-08-15

### Bug fixes

- Fixed splitting logic to handle diagrams starting with `<svg>` correctly [crossnote#376](https://github.com/shd101wyy/crossnote/issues/376) by @shiftdownet.

### Updates

- Updated `katex` version to the latest `0.16.22`.
- Updated `mermaid` version to the latest `11.9.0`.

## [0.9.14] - 2025-03-16

### Bug fixes

- Fixed the build for vscode-web caused by prismjs.

## [0.9.13] - 2025-03-16

### Bug fixes

- Fixed a bug of bundling caused by importing the [sharp](https://www.npmjs.com/package/sharp) package.

## [0.9.12] - 2025-03-16

### Changes

- Use [sharp](https://www.npmjs.com/package/sharp) to convert svg element to png file if `imageMagickPath` is empty. [crossnote#366](https://github.com/shd101wyy/crossnote/issues/366)

### Updates

- Updated `mermaid` version to the latest `11.5.0`.
- Updated `katex` version to the latest `0.16.21`.
- Updated `prismjs` version to the latest `1.30.0`.
- Updated `bit-field` version to the latest `1.9.0`.

### Bug fixes

- Fixed the import the crossnote as nodejs esm module. [crossnote#357](https://github.com/shd101wyy/crossnote/issues/357)
- Fixed a bug of using `enableExtendedTableSyntax`. [crossnote#369](https://github.com/shd101wyy/crossnote/issues/369)

## [0.9.11] - 2024-11-08

### Updates

- Updated `mermaid` version to the latest `11.4.0`.

## [0.9.10] - 2024-09-07

### Changes

- Added `.mdx` to the default `markdownFileExtensions`.

### Updates

- Updated `mermaid` version to the latest `11.1.1`.
- Updated `katex` version to the latest `v0.16.11`.

### Bug fixes

- Fixed a scroll sync bug.

## [0.9.9] - 2024-03-11

### Bug fixes

- Fixed [Long sidebarToc does not display completely](https://github.com/shd101wyy/crossnote/pull/354) by @moonlitusun
- Removed the `text` as the default language selector for code block.

### Chore

- Updated [flake.nix](./flake.nix) and node.js to 20.

## [0.9.8] - 2024-03-10

### New features

- @moonlitusun sidebarToc supports local caching

### Updates

- @oneWaveAdrian updated the `mermaid` version to the latest `10.9.0`.

### Bug fixes

- Fixed [[BUG] #tag is treated as Header 1](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1937)
- Fixed [[BUG] toml code block support is not very good](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1920)
- Fixed [[BUG] If URL encoding is used, the preview cannot be displayed.](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1934)

## [0.9.7] - 2023-12-10

### New features

- Added `enablePreviewZenMode` option and reorganized the right-click context menu.

  ![image](https://github.com/shd101wyy/crossnote/assets/1908863/26e2237e-c6e2-433e-a063-6de2c01a64bb)

### Bug fixes

- Fixed rendering `vega-lite` in `Reveal.js` slide: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1880
- Removed one github-dark background css attribute: https://github.com/shd101wyy/crossnote/issues/344

## [0.9.6] - 2023-10-24

### Changes

- Updated mermaid.js to the latest version 10.6.0.

### Bug fixes

- Fixed importing file with spaces in the path: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1857

## [0.9.5] - 2023-10-23

### Bug fixes

- Fixed of bug of rendering the KaTeX math expression: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1853

## [0.9.4] - 2023-10-21

### New features

- Updated [fontawesome](https://fontawesome.com/) from version 4.7 to version 6.4.2 (Free).  
  A list of available icons can be found at: https://kapeli.com/cheat_sheets/Font_Awesome.docset/Contents/Resources/Documents/index
- Updated WaveDrom to the latest version 3.3.0.

### Changes

- Changed the markdown parser process to be like below. We removed the `onWillTransformMarkdown` and `onDidTransformMarkdown` hooks as these two caused the confusion.

  ```markdown
  markdown
  ↓
  `onWillParseMarkdown(markdown)`
  ↓
  markdown
  ↓
  **crossnote markdown transformer**
  ↓
  markdown
  ↓
  **markdown-it or pandoc renderer**
  ↓
  html
  ↓
  `onDidParseMarkdown(html)`
  ↓
  html, and then rendered in the preview
  ```

- (Beta) Supported to export the selected element in preview to .png file and copy the blob to the clipboard:

  ![image](https://github.com/shd101wyy/vscode-markdown-preview-enhanced/assets/1908863/046759d8-6d89-4f41-8420-b863d2094fe7)

### Bug fixes

- Fixed a bug of importing files that contains empty heading: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1840
- Fixed a bug of rendering inline math in image name: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1846
- Fixed a bug of parsing inline code: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1848

## [0.9.3] - 2023-10-15

### Bug fixes

- Better handling of source map for importing files.

## [0.9.2] - 2023-10-15

### New features

- Added `ID` button to copy the element id to clipboard:

  ![Screenshot from 2023-10-15 15-34-27](https://github.com/shd101wyy/crossnote/assets/1908863/ede91390-3cca-4b83-8e30-33027bf0a363)

- Supported to import section of markdown by header id:

  ```markdown
  @import "test.md#header-id"

  or

  ![](test.md#header-id)

  or

  ![[test#header-id]]
  ```

### Bug fixes

- URL fragments on image links do not load: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1837
- Supported matplotlib-type preview for other Python tools like `pipenv`: https://github.com/shd101wyy/crossnote/issues/332

## [0.9.1] - 2023-10-14

### Buf fixes

- Fixed rendering vega and vega-lite. Also fixed `interactive=true` attribute for vega.

## [0.9.0] - 2023-10-13

### New features

- Added two more syntaxes to import files in addition to the `@import` syntax. Please note that these syntaxes only work on new lines. For example, they won't work within list items.
  - Use the image syntax but with other file extensions:
    ```markdown
    ![](path/to/file.md)
    ![](path/to/test.py){.line-numbers}
    ![](path/to/test.js){code_block=true}
    ```
  - Use the wikilink syntax but with other file extensions:
    ```markdown
    ![[file]]
    ![[path/to/test.py]]{.line-numbers}
    ![[path/to/test.js]]{code_block=true}
    ```

### Bug fixes

- Fixed a header id generation bug https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1833
- Fixed parsing block attributes from curly bracket when `enableTypographer` is enabled https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1823
- Fixed the bug of not rendering the `@import` file:
  - https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1832
  - https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1834
- Fixed rendering the vega and vega-lite diagrams.

## [0.8.24] - 2023-10-10

### Bug fixes

- Improved the handling of `[toc]`: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1825
- Supported to set env variables in paths of configuration: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1826
- Fixed the footer style: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1822
- Fixed the bug of generating the header id: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1827
- Fixed the bug of `@import` files that contains unicode characters: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1823
- Now use node.js 18 for the project.

## [0.8.23] - 2023-10-10

### Bug fixes

- Fixed exporting reveal.js presentation.

## [0.8.22] - 2023-10-10

### Bug fixes

- Fixed a bug of loading image https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1819
- Fixed a bug of parsing slides https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1818

## [0.8.21] - 2023-10-09

### Bug fixes

- Fixed a bug of rendering front-matter that caused the failure of rendering slides: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1814

## [0.8.20] - 2023-10-09

### New features

- Supported prefix in front of Kroki diagram types https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1785.  
  So now all diagrams below will get rendered using Kroki:

  ````markdown
  ```kroki-plantuml
  @startuml
  A -> B
  @enduml
  ```

  ```plantuml {kroki=true}
  @startuml
  A -> B
  @enduml
  ```
  ````

- Improved the source map handling for `@import "..."` syntax.

### Bug fixes

- Now exporting files won't include the source map.
- Fixed some Reveal.js presentation related bugs:
  - https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1815
  - https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1814

## [0.8.19] - 2023-10-06

### Changes

- Deprecated the `processWikiLink` in `parser.js`. Now `crossnote` handles how we process the wiki link.  
  We also added two more options:
  - `wikiLinkTargetFileExtension`: The file extension of the target file. Default is `md`. For example:
    - `[[test]]` will be transformed to `[test](test.md)`
    - `[[test.md]]` will be transformed to `[test](test.md)`
    - `[[test.pdf]]` will be transformed to `[test](test.pdf)` because it has a file extension.
  - `wikiLinkTargetFileNameChangeCase`: How we transform the file name. Default is `none` so we won't change the file name.  
    A list of available options can be found at: https://shd101wyy.github.io/crossnote/interfaces/NotebookConfig.html#wikiLinkTargetFileNameChangeCase

### Bug fixes

- Reverted the markdown transformer and deleted the logic of inserting anchor elements as it's causing a lot of problems.  
  The in-preview editor is not working as expected. So we now hide its highlight lines and elements feature if the markdown file failed to generate the correct source map.

## [0.8.18] - 2023-10-05

### New features

- Updated the `katex` version to `0.16.9`.

### Improvements

- Added `end-of-document` class name to the element of the last line of the preview.
- Exported the `KatexOptions` and `MermaidConfig` interfaces.

## [0.8.17] - 2023-10-04

### New features

- 📝 Supported in-preview editor that allows you to edit the markdown file directly in the preview 🎉.  
  This feature is currently in beta.  
  When the editor is open, you can press `ctrl+s` or `cmd+s` to save the markdown file. You can also press `esc` to close the editor.
- Deprecated the VS Code setting `markdown-preview-enhanced.singlePreview`.  
  Now replaced by `markdown-preview-enhanced.previewMode`:
  - **Single Preview** (_default_)  
    Only one preview will be shown for all editors.
  - **Multiple Previews**  
    Multiple previews will be shown. Each editor has its own preview.
  - **Previews Only** 🆕  
    No editor will be shown. Only previews will be shown. You can use the in-preview editor to edit the markdown.
- Supported to set attribute to image and link, e.g.:

  ```markdown
  ![](path/to/image.png){width=100 height=100}
  ```

- Improved the markdown transformer to better insert anchors for scroll sync and highlight lines and elements.  
  Added more tests for the markdown transformer to make sure it works as expected.
- Added the reading time estimation in the preview footer ⏲️.
- Added `Edit Markdown` menu item to the context menu of the preview, which offers two options:
  - **Open VS Code Editor**
    Open the markdown file in VS Code editor.
  - **Open In-preview Editor**
    Open the markdown file in the in-preview editor.
- Updated the mermaid version to the latest `10.5.0`
- Added the API website: https://shd101wyy.github.io/crossnote/

### Bug fixes

- Fixed the font size of the `github-dark.css` code block theme.
- Fixed the anchor jump bugs: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1790
- Fixed list item style bug: https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1789
- Fixed a data race bug that caused the preview to hang.

## [0.8.16] - 2023-09-24

### New features

- Added `head.html` config file to allow you to include custom HTML in the `<head>` of the preview.
  This could be useful for adding custom CSS or JavaScript to the preview.

### Bug fixes

- Fixed the `none.css` preview theme bug https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1778.
- Fixed the bug of copying texts in preview https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1775.
- Added `<code>` in `<pre>` while rendering code blocks in preview.

## [0.8.15] - 2023-09-17

### New features

- Added the `includeInHeader` option, which allows you to include custom HTML in the `<head>` of the preview.
  This could be useful for adding custom CSS or JavaScript to the preview.

### Bug fixes

- Fixed the bug of missing the backlinks on the `vue.css` theme.
- Fixed the back to top button. https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1769

## [0.8.14] - 2023-09-15

### New features

- (Beta) Added the [bitfield](https://github.com/wavedrom/bitfield) diagram support. Supported both `bitfield` and `bit-field` code fences. https://github.com/shd101wyy/vscode-markdown-preview-enhanced/issues/1749
  ````
  ```bitfield {vspace=100}
  [
    {name: 'IPO',   bits: 8},
    {               bits: 7},
    {name: 'BRK',   bits: 5, type: 4},
    {name: 'CPK',   bits: 1},
    {name: 'Clear', bits: 3, type: 5},
    {               bits: 8}
  ]
  ```
  ````

### Bug fixes

- Fixed the `vue.css` theme bug that caused the missing scroll bar in the preview. Also fixed a context menu bug for selecting the `vue.css` theme.

## [0.8.13] - 2023-09-15

### Bug fixes

- Fixed rendering MathJax in preview https://github.com/shd101wyy/crossnote/pull/311.
- Fixed the preview background color https://github.com/shd101wyy/crossnote/pull/312.
- Added error message when failed to parse the YAML front-matter. Also escaped the HTML rendered in the front-matter table in preview. https://github.com/shd101wyy/crossnote/pull/312.

## [0.8.12] - 2023-09-15
