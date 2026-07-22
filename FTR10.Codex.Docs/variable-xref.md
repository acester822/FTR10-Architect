# FTR10 Variable Cross-Reference (Corrected)

> **Correction notice:** The previous version of this file conflated "appears in
> `deriveCodexPreset()`" with "is generated from the palette wheel." Many vars
> set by `deriveCodexPreset()` use hardcoded literal values that do **not** change
> when the user adjusts the 6-color Architect palette. This version distinguishes
> **truly palette-generated** from **merely set-by-the-function-but-not-derived**.

Source of truth:
- **Generate function** = `deriveCodexPreset()` + `accentDerived()` in `src/theme-sync/presets.ts`
- **colors.css** = `~/.ftr10/css.files/colors.css` (277 `--ftr10-*` declarations)
- **DEFAULT_VALUES** = `src/theme-sync/constants.ts` (271 values)
- **Config UI** = `buildDefaultConfig()` sections in `src/theme-sync/config.ts` (279 keys in UI panels)

---

## 1. Truly Palette-Generated (110)

These vars change value when the user adjusts the 6-color Architect wheel (c1–c6).
They use c1–c6 directly, or are computed from c1 via `accentDerived()` or syntax-token
`_hexLerp()` / `_commentColorFromAccent()` helpers.

### Tier 1 — Direct from swatch colors (12)

| Variable | Source |
|---|---|
| `--ftr10-accent-1` | c1 + `'d4'` (alpha added) |
| `--ftr10-accent-2` | c2 |
| `--ftr10-accent-3` | c3 |
| `--ftr10-accent-4` | c4 |
| `--ftr10-surface-1` | c5 + `'30'` |
| `--ftr10-surface-2` | c6 + `'18'` |
| `--ftr10-cursor` | c4 |
| `--ftr10-tab-border-color` | c1 |
| `--ftr10-border` | c1 + `'20'` |
| `--ftr10-bg-ambient` | radial gradients from all 6 c1–c6 |
| `--ftr10-editor-line-number-beam-gradient` | gradient using c1, c4, c2 |
| `--ftr10-tab-active-beam-gradient` | gradient using c1, c4, c2 |

### Tier 2 — accentDerived() from c1's RGB (26)

All use c1's RGB channels with varying alpha opacities:

```
--ftr10-glass-bg-hover
--ftr10-glass-bg-active
--ftr10-glass-bg-breadcrumb-hover
--ftr10-border-base
--ftr10-border-base-70
--ftr10-border-subtle
--ftr10-glass-border-top
--ftr10-glass-border-side
--ftr10-glass-border-top-soft
--ftr10-glass-border-side-soft
--ftr10-glass-outline-soft
--ftr10-shadow-focus
--ftr10-shadow-popup
--ftr10-shadow-selection
--ftr10-shadow-selected-focused
--ftr10-shadow-inner-outline
--ftr10-inset-light-edges
--ftr10-inset-light-shadow
--ftr10-editor-current-line-bg
--ftr10-highlight
--ftr10-activitybar-hover-bg
--ftr10-activitybar-hover-outer-glow
--ftr10-activitybar-hover-inner-glow
--ftr10-accent-shadow-red
--ftr10-accent-shadow-red-strong
--ftr10-text-shadow-hover
```

### Tier 3 — Palette-derived syntax tokens (72)

Use c1–c4 via `_hexLerp()`, `_commentColorFromAccent()`, or intermediate helpers
(`_c4l`, `_c1s`, `_c2m`, `_c3m`):

```
--ftr10-token-keyword
--ftr10-token-keyword-control
--ftr10-token-keyword-other
--ftr10-token-storage
--ftr10-token-module
--ftr10-token-constant
--ftr10-token-constant-placeholder
--ftr10-token-string
--ftr10-token-string-escape
--ftr10-token-template
--ftr10-token-number
--ftr10-token-boolean
--ftr10-token-function
--ftr10-token-function-def
--ftr10-token-type
--ftr10-token-class
--ftr10-token-class-variable
--ftr10-token-class-method
--ftr10-token-comment
--ftr10-token-punctuation
--ftr10-token-variable
--ftr10-token-property
--ftr10-token-operator
--ftr10-token-tag
--ftr10-token-selector
--ftr10-token-namespace
--ftr10-token-block
--ftr10-token-html-outer
--ftr10-token-html-inner
--ftr10-token-html-attribute
--ftr10-token-html-entity
--ftr10-token-css-class
--ftr10-token-css-id
--ftr10-token-css-tag
--ftr10-token-css-property
--ftr10-token-yaml-key
--ftr10-token-json-key
--ftr10-token-json-constant
--ftr10-token-json-0 through --ftr10-token-json-8
--ftr10-token-md-heading
--ftr10-token-md-link
--ftr10-token-md-list
--ftr10-token-md-italic
--ftr10-token-md-bold
--ftr10-token-md-bold-italic
--ftr10-token-md-code
--ftr10-token-md-inline-code
--ftr10-token-md-blockquote
--ftr10-token-md-blockquote-punct
--ftr10-token-md-fenced
--ftr10-token-ini-property
--ftr10-token-ini-section
--ftr10-token-cs-class
--ftr10-token-cs-method
--ftr10-token-cs-function
--ftr10-token-cs-type
--ftr10-token-cs-return
--ftr10-token-cs-namespace
--ftr10-token-jsx-text
--ftr10-token-jsx-component
--ftr10-token-py-member
--ftr10-token-py-self
--ftr10-token-py-format
--ftr10-token-cpp-variable
```

---

## 2. Not Palette-Generated (167)

These are NOT derived from the 6-color wheel. They fall into three sub-categories:

### 2a. Hard-coded in `deriveCodexPreset()` (18)

These appear in the generate function but their values are **literal strings** that do
**not** depend on c1–c6:

| Variable | Value | Why not palette |
|---|---|---|
| `--ftr10-bg` | `#00000000` | Literal hex |
| `--ftr10-bg-editor` | `#020408ff` | Literal hex |
| `--ftr10-bg-effect` | `session.bgEffect \|\| 'nebula'` | User's Architect choice, not palette |
| `--ftr10-thpace-enabled` | `session.thpaceEnabled \|\| 'true'` | User's Architect choice, not palette |
| `--ftr10-text` | `#ffffffe6` | Literal hex |
| `--ftr10-text-muted` | `#ffffff73` | Literal hex |
| `--ftr10-body-font` | `'Victor Mono', monospace` | Literal font string |
| `--ftr10-heading-font` | `'Orbitron', 'Victor Mono', monospace` | Literal font string |
| `--ftr10-code-font` | `'Victor Mono', monospace` | Literal font string |
| `--ftr10-font-activitybar` | `'Space Grotesk', monospace` | Literal font string |
| `--ftr10-font-sidebar` | `'Space Grotesk', monospace` | Literal font string |
| `--ftr10-font-panel-bottom` | `'Orbitron', monospace` | Literal font string |
| `--ftr10-font-panel-top` | `'JetBrains Mono', monospace` | Literal font string |
| `--ftr10-font-auxiliarybar` | `'Cartograph', monospace` | Literal font string |
| `--ftr10-tab-gradient` | `linear-gradient(to top, var(...))` | Uses `var()` ref, no palette value computed |
| `--ftr10-token-markup-deleted` | `#ff6b78` | Literal hex — semantic diff red |
| `--ftr10-token-markup-inserted` | `#73d980` | Literal hex — semantic diff green |
| `--ftr10-token-cs-preprocessor` | `#545454` | Literal hex — always gray |

### 2b. var() / color-mix() references to palette-generated vars (65)

These are NOT palette-generated themselves, but their value is a `var()` or `color-mix()`
expression that references a palette-generated var. They **visually track** the palette at
render time through CSS variable resolution.

**Accent-1 alpha variants (7)** — all `color-mix(in srgb, var(--ftr10-accent-1) N%, transparent)`
```
--ftr10-accent-1-08  --ftr10-accent-1-10  --ftr10-accent-1-15
--ftr10-accent-1-20  --ftr10-accent-1-45  --ftr10-accent-1-50
--ftr10-accent-1-70
```

**Cursor alpha variants (2)** — `color-mix(in srgb, var(--ftr10-cursor) N%, transparent)`
```
--ftr10-cursor-20  --ftr10-cursor-50
```

**Text alpha variants (11)** — `color-mix(in srgb, var(--ftr10-text) N%, transparent)`
```
--ftr10-text-05  --ftr10-text-06  --ftr10-text-10  --ftr10-text-15
--ftr10-text-30  --ftr10-text-40  --ftr10-text-60  --ftr10-text-70
--ftr10-text-80  --ftr10-text-muted-50  --ftr10-text-muted-70
```

**Text tie-ins (3)** — `var(--ftr10-text)` or `var(--ftr10-text-muted)`
```
--ftr10-strong-color  --ftr10-em-color  --ftr10-mark-color
```

**Highlight alpha (1)** — `color-mix(in srgb, var(--ftr10-highlight) 50%, transparent)`
```
--ftr10-highlight-50
```

**Heading colors (5)** — `var(--ftr10-accent-1/2/3/4)` and `var(--ftr10-surface-1)`
```
--ftr10-h1-color  --ftr10-h2-color  --ftr10-h3-color
--ftr10-h4-color  --ftr10-h5-color
```

**Blockquote (1)** — `var(--ftr10-accent-1)`
```
--ftr10-blockquote-border
```

**Code (1)** — `var(--ftr10-accent-1)`
```
--ftr10-code-border-l
```

**Editor (2)** — `var(--ftr10-success)` and `var(--ftr10-warning)`
```
--ftr10-editor-line-number-active   --ftr10-editor-line-number-inactive
```

**Charts (6)** — `var(--ftr10-info/success/warning/error/purple)`
```
--ftr10-charts-blue   --ftr10-charts-green   --ftr10-charts-orange
--ftr10-charts-purple --ftr10-charts-red     --ftr10-charts-yellow
```

**Semantic alpha variants (15)** — `color-mix()` of hand-set status colors
```
--ftr10-success-08  --ftr10-success-30  --ftr10-success-60  --ftr10-success-90
--ftr10-error-08    --ftr10-error-60    --ftr10-error-70    --ftr10-error-90
--ftr10-warning-30  --ftr10-warning-60  --ftr10-warning-70  --ftr10-warning-90
--ftr10-info-30     --ftr10-info-60     --ftr10-info-70     --ftr10-info-90
```

**Surface tie-ins (4)** — `var(--ftr10-surface-1)` / `var(--ftr10-surface-2)` / `color-mix()`
```
--ftr10-surface       (= var(--ftr10-surface-1))
--ftr10-surface-1-50  (= color-mix(in srgb, var(--ftr10-surface-1) 50%, transparent))
--ftr10-surface-2-60  (= color-mix(in srgb, var(--ftr10-surface-2) 60%, transparent))
--ftr10-surface-hover (= var(--ftr10-surface-2))
```

**Disabled alpha (1)** — `color-mix(in srgb, var(--ftr10-disabled) 20%, transparent)`
```
--ftr10-disabled-20
```

**Thpace (2)** — string references to accent vars (used by thpace JS engine)
```
--ftr10-thpace-1  (= --ftr10-accent-1)
--ftr10-thpace-3  (= --ftr10-accent-3)
```

**Panel backgrounds (2)** — `var(--ftr10-panel-overlay), var(--ftr10-bg-image-panels)`
```
--ftr10-bg-sidebar  --ftr10-bg-panel-bottom
```

**Tab gradient (1)** — `linear-gradient(to top, var(--ftr10-tab-border-color) ...)`
```
--ftr10-tab-gradient
```

### 2c. Fully independent (no var() ref to any palette var) — 84

These are literal values that do not reference palette-generated vars. They are
the "real customization surface" — areas, radii, opacities, thpace tuning, etc.

**Backgrounds (4)**
```
--ftr10-bg-image          --ftr10-bg-image-panels
--ftr10-bg-sticky         --ftr10-panel-overlay
```

**Activity bar (1)**
```
--ftr10-activitybar-hover-image-opacity
```

**Blockquotes (2)**
```
--ftr10-blockquote-bg    --ftr10-blockquote-width
```

**Blur (3)**
```
--ftr10-blur-sm    --ftr10-blur-md    --ftr10-blur-lg
```

**Border (1)**
```
--ftr10-border-style
```

**Code (3)**
```
--ftr10-code-bg    --ftr10-code-border-r    --ftr10-code-scanline
```

**Corner (1)**
```
--ftr10-corner-shape
```

**Editor (3)**
```
--ftr10-editor-line-number-beam-duration
--ftr10-editor-line-number-beam-height
--ftr10-editor-line-number-beam-inset
```

**Fonts (8 — DEFAULT_VALUES, differ from hardcoded deriveCodexPreset values)**
```
--ftr10-body-font         --ftr10-heading-font       --ftr10-code-font
--ftr10-font-activitybar  --ftr10-font-sidebar       --ftr10-font-panel-bottom
--ftr10-font-panel-top    --ftr10-font-auxiliarybar
```
> Note: the DEFAULT_VALUES for these are `'inherit'` or `'Inter', sans-serif`,
> while `deriveCodexPreset()` overwrites them with monospace fonts. So the
> **Architect preset** changes fonts, but the change is a hardcoded string,
> not wheel-derived.

**Glass (9)**
```
--ftr10-glass-bg              --ftr10-glass-bg-menu
--ftr10-glass-bg-menu-layer   --ftr10-glass-bg-widget
--ftr10-glass-bg-widget-strong --ftr10-glass-bg-overlay
--ftr10-glass-bg-sticky       --ftr10-glass-border-bottom
--ftr10-glass-border-bottom-soft
```

**Heading typography (2)**
```
--ftr10-heading-spacing   --ftr10-heading-transform
```

**Links (3)**
```
--ftr10-link-style   --ftr10-link-hover-shadow   --ftr10-link-hover-transform
```

**Lists (1)**
```
--ftr10-list-bg-hover
```

**Mark (1)**
```
--ftr10-mark-bg
```

**Misc semantic (2)**
```
--ftr10-on-accent  --ftr10-cyan
```

**Opacity (6)**
```
--ftr10-opacity-activitybar   --ftr10-opacity-sidebar
--ftr10-opacity-panel-bottom  --ftr10-opacity-panel-top
--ftr10-opacity-auxiliarybar  --ftr10-opacity-pane
```

**Radii (14)**
```
--ftr10-radius-xs     --ftr10-radius-sm      --ftr10-radius-md
--ftr10-radius-lg     --ftr10-radius-row     --ftr10-radius-beam
--ftr10-radius-pill   --ftr10-radius-panes   --ftr10-radius-selections
--ftr10-radius-img    --ftr10-radius-inline  --ftr10-radius-block
--ftr10-radius-quote  --ftr10-corner-shape
```
> Note: `--ftr10-radius-panes` and `--ftr10-radius-selections` are `var()` refs to
> other radius vars (which are themselves hand-set). They don't track palette vars.

**Shadows (3)**
```
--ftr10-shadow-light   --ftr10-shadow-heavy   --ftr10-shadow-dialog
```

**Inset (1)**
```
--ftr10-inset-dark-shadow
```

**Surface (2)**
```
--ftr10-surface-3           --ftr10-surface-3-60
```

**Tab beam/stripe (6)**
```
--ftr10-tab-active-beam-height
--ftr10-tab-active-beam-radius
--ftr10-tab-active-beam-duration
--ftr10-tab-active-stripe-gradient
--ftr10-tab-active-stripe-height
--ftr10-tab-active-stripe-duration
```

**Thpace tuning (11)**
```
--ftr10-thpace-2
--ftr10-thpace-colors
--ftr10-thpace-opacity
--ftr10-thpace-zindex
--ftr10-thpace-triangle-size
--ftr10-thpace-bleed
--ftr10-thpace-noise
--ftr10-thpace-point-variation-x
--ftr10-thpace-point-variation-y
--ftr10-thpace-animation-speed
--ftr10-thpace-max-fps
```

### 2d. Config UI keys not in colors.css (7)

These appear in the Backgrounds section of the config UI but have no entry
in `colors.css` or `DEFAULT_VALUES` — they are opt-in fields the user can fill:

```
--ftr10-accent-1-80
--ftr10-bg-activitybar
--ftr10-bg-auxiliarybar
--ftr10-bg-panel-top
--ftr10-bg-pattern
--ftr10-bg-pattern-pos
--ftr10-bg-pattern-size
```

---

## 3. Generated Vars Not Exposed in the Config UI (5)

These vars are palette-generated but have **no editable field** in any config section:

```
--ftr10-bg-ambient          (generated from all 6 colors, no UI)
--ftr10-token-operator      (generated from palette, no UI — legacy compat)
--ftr10-token-property      (generated from palette, no UI — legacy compat)
--ftr10-token-selector      (generated from palette, no UI — legacy compat)
--ftr10-token-tag           (generated from palette, no UI — legacy compat)
```

The four `token-*` vars are legacy preset-compat aliases kept for backward
compatibility with older presets — they are set by `deriveCodexPreset()` but
not listed in any UI section.

---

## Summary

| Category | Count |
|---|---|
| **Truly palette-generated** (value changes with palette wheels) | **110** |
| └ Direct from c1–c6 | 12 |
| └ `accentDerived()` from c1 RGB | 26 |
| └ Palette-derived syntax tokens | 72 |
| **Hardcoded token aliases** (in IIFE but literal values, not palette-dependent) | **3** |
| └ `--ftr10-token-markup-deleted`, `--ftr10-token-markup-inserted`, `--ftr10-token-cs-preprocessor` | |
| **Track palette through var()/color-mix()** (in colors.css) | **25** |
| **Fully independent** (in colors.css) | **139** |
| **UI-only keys** (not in colors.css) | **7** |
| **Total unique vars** | **277** (+ 7 UI-only = 284 total touchpoints) |

**Key insight:** A var does NOT need to be "generated" to visually track the palette.
25 vars use `var()` or `color-mix()` references to palette-generated vars, making them
visually responsive at render time even though they're not computed by the generate
function. For example, `--ftr10-h1-color: var(--ftr10-accent-1)` will follow accent-1
whenever the wheel changes, purely through CSS variable resolution.

---

## 4. Complete List: Vars with NO Association to Palette Colors (146)

These vars are **not palette-generated** and their value does **not** reference any
palette-generated var (directly or through var()/color-mix() chains). They are truly
independent — changing the 6-color Architect wheel has zero effect on their rendered value.

```
--ftr10-accent-1-80              (UI only — no default)
--ftr10-accent-5                 = #fda4af
--ftr10-activitybar-hover-image-opacity = 1
--ftr10-bg                       = #0a0a0fff
--ftr10-bg-activitybar           (UI only — no default)
--ftr10-bg-auxiliarybar          (UI only — no default)
--ftr10-bg-editor                = #0a0a0fff
--ftr10-bg-effect                = nebula
--ftr10-bg-image                 = none
--ftr10-bg-image-panels          = none
--ftr10-bg-panel-bottom          = var(--ftr10-panel-overlay), var(--ftr10-bg-image-panels)
--ftr10-bg-panel-top             (UI only — no default)
--ftr10-bg-pattern               (UI only — no default)
--ftr10-bg-pattern-pos           (UI only — no default)
--ftr10-bg-pattern-size          (UI only — no default)
--ftr10-bg-sidebar               = var(--ftr10-panel-overlay), var(--ftr10-bg-image-panels)
--ftr10-bg-sticky                = #0c0e13ff
--ftr10-blockquote-bg            = #00000033
--ftr10-blockquote-width         = 2px
--ftr10-blur-lg                  = blur(12px)
--ftr10-blur-md                  = blur(8px)
--ftr10-blur-sm                  = blur(2px)
--ftr10-body-font                = 'Space Grotesk', monospace
--ftr10-border-style             = solid
--ftr10-charts-blue              = var(--ftr10-info)
--ftr10-charts-green             = var(--ftr10-success)
--ftr10-charts-orange            = var(--ftr10-warning)
--ftr10-charts-purple            = var(--ftr10-purple)
--ftr10-charts-red               = var(--ftr10-error)
--ftr10-charts-yellow            = var(--ftr10-warning)
--ftr10-code-bg                  = #0000004c
--ftr10-code-border-r            = transparent
--ftr10-code-font                = 'Fira Code', monospace
--ftr10-code-scanline            = #00f5ff06
--ftr10-corner-shape             = squircle
--ftr10-cyan                     = #f9a8d4
--ftr10-disabled                 = #384149
--ftr10-disabled-20              = color-mix(in srgb, var(--ftr10-disabled) 20%, transparent)
--ftr10-editor-line-number-active  = var(--ftr10-success)
--ftr10-editor-line-number-beam-duration = 3s
--ftr10-editor-line-number-beam-height  = 2px
--ftr10-editor-line-number-beam-inset  = 12px
--ftr10-editor-line-number-inactive    = var(--ftr10-warning)
--ftr10-em-color                 = #00f5ff
--ftr10-error                    = #ff5c75
--ftr10-error-08                 = color-mix(in srgb, var(--ftr10-error) 8%, transparent)
--ftr10-error-60                 = color-mix(in srgb, var(--ftr10-error) 60%, transparent)
--ftr10-error-70                 = color-mix(in srgb, var(--ftr10-error) 70%, transparent)
--ftr10-error-90                 = color-mix(in srgb, var(--ftr10-error) 90%, transparent)
--ftr10-font-activitybar         = 'Space Grotesk', monospace
--ftr10-font-auxiliarybar        = 'Space Grotesk', monospace
--ftr10-font-panel-bottom        = 'Recursive', monospace
--ftr10-font-panel-top           = 'Fira Code', monospace
--ftr10-font-sidebar             = 'Space Grotesk', monospace
--ftr10-glass-bg                 = #13161d80
--ftr10-glass-bg-menu            = #0d0f16c7
--ftr10-glass-bg-menu-layer      = #0d0f1680
--ftr10-glass-bg-overlay         = #0a0c128c
--ftr10-glass-bg-sticky          = #0c0e13d9
--ftr10-glass-bg-widget          = #13161dc7
--ftr10-glass-bg-widget-strong   = #0f1117f0
--ftr10-glass-border-bottom      = 2px solid #0000004c
--ftr10-glass-border-bottom-soft = 1px solid #00000033
--ftr10-heading-font             = 'Recursive', 'Space Grotesk', monospace
--ftr10-heading-spacing          = 2px
--ftr10-heading-transform        = uppercase
--ftr10-info                     = #38bdf8
--ftr10-info-30                  = color-mix(in srgb, var(--ftr10-info) 30%, transparent)
--ftr10-info-60                  = color-mix(in srgb, var(--ftr10-info) 60%, transparent)
--ftr10-info-70                  = color-mix(in srgb, var(--ftr10-info) 70%, transparent)
--ftr10-info-90                  = color-mix(in srgb, var(--ftr10-info) 90%, transparent)
--ftr10-inset-dark-shadow        = 0 1px 3px 0 #00000059
--ftr10-link-hover-shadow        = none
--ftr10-link-hover-transform     = none
--ftr10-link-style               = dashed
--ftr10-list-bg-hover            = #121212db
--ftr10-mark-bg                  = #00f5ff1a
--ftr10-mark-color               = #00f5ff
--ftr10-on-accent                = #333333e6
--ftr10-opacity-activitybar      = 0.4
--ftr10-opacity-auxiliarybar     = 0.4
--ftr10-opacity-pane             = 1
--ftr10-opacity-panel-bottom     = 0.4
--ftr10-opacity-panel-top        = 0.4
--ftr10-opacity-sidebar          = 0.4
--ftr10-panel-overlay            (UI only — no default)
--ftr10-purple                   = #c084fc
--ftr10-radius-beam              = 50px
--ftr10-radius-block             = 3px
--ftr10-radius-img               = 4px
--ftr10-radius-inline            = 2px
--ftr10-radius-lg                = 14px
--ftr10-radius-md                = 10px
--ftr10-radius-panes             = var(--ftr10-radius-lg)
--ftr10-radius-pill              = 9999px
--ftr10-radius-quote             = 3px
--ftr10-radius-row               = 20px
--ftr10-radius-selections        = var(--ftr10-radius-sm)
--ftr10-radius-sm                = 6px
--ftr10-radius-xs                = 4px
--ftr10-shadow-dialog            = 0 16px 48px #000000a6
--ftr10-shadow-heavy             = 0 4px 20px #00000099
--ftr10-shadow-light             = 2px 2px 8px 4px #00000040
--ftr10-strong-color             = #00f5ff
--ftr10-success                  = #65bc4a
--ftr10-success-08               = color-mix(in srgb, var(--ftr10-success) 8%, transparent)
--ftr10-success-30               = color-mix(in srgb, var(--ftr10-success) 30%, transparent)
--ftr10-success-60               = color-mix(in srgb, var(--ftr10-success) 60%, transparent)
--ftr10-success-90               = color-mix(in srgb, var(--ftr10-success) 90%, transparent)
--ftr10-surface-3                = #232838
--ftr10-surface-3-60             = color-mix(in srgb, var(--ftr10-surface-3) 60%, transparent)
--ftr10-surface-hover*           = #00f5ff0f (note: DEFAULT is var(--ftr10-surface-2))
--ftr10-tab-active-beam-duration  = 6s
--ftr10-tab-active-beam-height    = 4px
--ftr10-tab-active-beam-radius    = 50px
--ftr10-tab-active-stripe-duration = 1s
--ftr10-tab-active-stripe-gradient = repeating-linear-gradient(-70deg, ...)
--ftr10-tab-active-stripe-height  = 6px
--ftr10-text                     = #ffffffe6
--ftr10-text-05                  = color-mix(in srgb, var(--ftr10-text) 5%, transparent)
--ftr10-text-06                  = color-mix(in srgb, var(--ftr10-text) 6%, transparent)
--ftr10-text-10                  = color-mix(in srgb, var(--ftr10-text) 10%, transparent)
--ftr10-text-15                  = color-mix(in srgb, var(--ftr10-text) 15%, transparent)
--ftr10-text-30                  = color-mix(in srgb, var(--ftr10-text) 30%, transparent)
--ftr10-text-40                  = color-mix(in srgb, var(--ftr10-text) 40%, transparent)
--ftr10-text-60                  = color-mix(in srgb, var(--ftr10-text) 60%, transparent)
--ftr10-text-70                  = color-mix(in srgb, var(--ftr10-text) 70%, transparent)
--ftr10-text-80                  = color-mix(in srgb, var(--ftr10-text) 80%, transparent)
--ftr10-text-muted               = #ffffff73
--ftr10-text-muted-50            = color-mix(in srgb, var(--ftr10-text-muted) 50%, transparent)
--ftr10-text-muted-70            = color-mix(in srgb, var(--ftr10-text-muted) 70%, transparent)
--ftr10-thpace-2                 = transparent
--ftr10-thpace-animation-speed   = 9000
--ftr10-thpace-bleed             = 140
--ftr10-thpace-colors            = ["--ftr10-thpace-1","--ftr10-thpace-2","--ftr10-thpace-3"]
--ftr10-thpace-enabled           = true
--ftr10-thpace-max-fps           = 30
--ftr10-thpace-noise             = 70
--ftr10-thpace-opacity           = 0.9
--ftr10-thpace-point-variation-x = 18
--ftr10-thpace-point-variation-y = 32
--ftr10-thpace-triangle-size     = 160
--ftr10-thpace-zindex            = 0
--ftr10-warning                  = #f0b429
--ftr10-warning-30               = color-mix(in srgb, var(--ftr10-warning) 30%, transparent)
--ftr10-warning-60               = color-mix(in srgb, var(--ftr10-warning) 60%, transparent)
--ftr10-warning-70               = color-mix(in srgb, var(--ftr10-warning) 70%, transparent)
--ftr10-warning-90               = color-mix(in srgb, var(--ftr10-warning) 90%, transparent)
```

> *`--ftr10-surface-hover` is marked because its default value (`var(--ftr10-surface-2)`)
> would trace to the palette, but the current colors.css has an independent literal value.
> The DEFAULT_VALUES design is the authoritative reference for "not associated."

### For reference: the 25 vars that DO track palette through var()/color-mix() chains

These are not generated themselves, but their DEFAULT_VALUES contain a `var()` or `color-mix()`
reference to a palette-generated var:

```
--ftr10-accent-1-08  --ftr10-accent-1-10  --ftr10-accent-1-15  --ftr10-accent-1-20
--ftr10-accent-1-45  --ftr10-accent-1-50  --ftr10-accent-1-70
--ftr10-blockquote-border  --ftr10-code-border-l
--ftr10-cursor-20  --ftr10-cursor-50
--ftr10-h1-color  --ftr10-h2-color  --ftr10-h3-color  --ftr10-h4-color  --ftr10-h5-color
--ftr10-highlight-50
--ftr10-surface  --ftr10-surface-1-50  --ftr10-surface-2-60  --ftr10-surface-hover
--ftr10-tab-gradient
--ftr10-thpace-1  --ftr10-thpace-3  --ftr10-thpace-colors
```

@plugin "daisyui/theme" {
  name: "dark";
  default: false;
  prefersdark: false;
  color-scheme: "dark";
  --color-base-100: oklch(25.33% 0.016 252.42);
  --color-base-200: oklch(23.26% 0.014 253.1);
  --color-base-300: oklch(21.15% 0.012 254.09);
  --color-base-content: oklch(97.807% 0.029 256.847);
  --color-primary: oklch(58% 0.233 277.117);
  --color-primary-content: oklch(96% 0.018 272.314);
  --color-secondary: oklch(65% 0.241 354.308);
  --color-secondary-content: oklch(94% 0.028 342.258);
  --color-accent: oklch(77% 0.152 181.912);
  --color-accent-content: oklch(38% 0.063 188.416);
  --color-neutral: oklch(14% 0.005 285.823);
  --color-neutral-content: oklch(92% 0.004 286.32);
  --color-info: oklch(74% 0.16 232.661);
  --color-info-content: oklch(29% 0.066 243.157);
  --color-success: oklch(76% 0.177 163.223);
  --color-success-content: oklch(37% 0.077 168.94);
  --color-warning: oklch(82% 0.189 84.429);
  --color-warning-content: oklch(41% 0.112 45.904);
  --color-error: oklch(71% 0.194 13.428);
  --color-error-content: oklch(27% 0.105 12.094);
  --radius-selector: 0.5rem;
  --radius-field: 0.25rem;
  --radius-box: 0.5rem;
  --size-selector: 0.25rem;
  --size-field: 0.25rem;
  --border: 1px;
  --depth: 1;
  --noise: 0;
}