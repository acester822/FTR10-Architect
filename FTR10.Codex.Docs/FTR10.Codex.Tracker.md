# FTR10 Codex · Issues Tracker

> Tags: `[FTR10]` Theme Customization Engine · `[MPAE]` markdown preview extension · `[BOTH]` shared concern · `[INSTALL]` packaging/distribution

---

## 🔴 Bugs

- [ ] `[BOTH]` Areas that use blur are struggling with the transparent layering, if they have nothing behind them in their next layer down blur does not work well, need to figure out a good solution for this


---

## 🟡 In Progress

- [ ] `[BOTH]` Right click menus, need themed more
- [ ] `[INSTALL]` Refine MPAE, Dark Glass, and Icons extensions into one unified extension  
  - Partially implemented, theme colorization done, need to do Icons (Folder and Action Bar)
---

## 🔵 Up Next

- [ ] `[MPAE]`  Further refine syntax highlighting to better accent the themes
- [ ] `[FTR10]` Add performance metrics, (CPU/memory, extension count, slow extension warnings)
- [ ] `[MPAE]`  Fix preview editing behavior — add setting to auto-switch preview to right pane on `Edit in VS Code`
- [ ] `[MPAE]`  Add popular MD inserts via context menu (e.g. `Insert Callout` → submenu of accepted callout types → inserts at cursor)
- [ ] `[MPAE]` Radial action menu, footer, and floating icon dock should match the active theme/palette
- [ ] `[FTR10]` Add terminal line styling that MPAE has to the code-server terminal
- [ ] `[MPAE]`  Go through right-click context menu — audit what works, what's broken, what should be removed
- [ ] `[MPAE]`  Update all dependencies and further harden extension security
- [ ] `[INSTALL]` Figure out most streamlined install — full extension install or small companion script?

---

## ✅ Complete

- [x] `[MPAE]`  Make syntax highlighting sync with FTR10 Codex
- [x] `[FTR10]` Add complete font registry on Codeserver side
- [x] `[FTR10]` Right click menus, some sub menus do not work, right click in the main editor window is transparent
- [x] `[MPAE]`  Add Edit in VS Code to Radial Menu
- [x] `[FTR10]` Add syntax highlighting color sync
- [x] `[MPAE]` Add the ability to collapse sections via headers — 04.01.26
  > Heading toggle buttons (▼/▶) injected into each h1–h6, section bodies wrapped in `div.md-section-body`, per-section localStorage persistence, collapse-all/expand-all button in topbar
- [x] `[MPAE]` Reduce file count — eliminate unused files, merge similar JS scripts
- [x] `[MPAE]` Fix text color and text shadows — 03.31.26
  > `code[class*='language-'], pre[class*='language-'] { color: #aeaeae; text-shadow: none; }` — applied to main theme (aces_codepunk.css)
- [x] `[MPAE]` Fix line number alignment and recolor — 03.31.26
  > `.random-thing-rows > span::before { text-align: center; width: 3em !important; }` — applied to main theme
- [x] `[MPAE]` Fix ugly grey HR divider — 03.31.26
  > Replaced with gradient `linear-gradient(90deg, transparent, #f5a14c, #ffb366, #f5a14c, transparent)` — applied to main theme
- [x] `[MPAE]` Add `mpae.writeThemeVars` command handler to `src/extension-common.ts`

