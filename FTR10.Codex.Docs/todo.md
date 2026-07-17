# To Do

## Current
- [x] Palette generator works, theme card (sessions) live update to the colors the palette generates (good), but the colors never actually change for anything
        - Intended behavior: When the palette changes colors, it fires the watcher that controls the live DOM update. Color changes should be instant, but not saved. If the user likes the color changes they could then optionally save the change. This is for only the elements in the upper palette generator area, aka the color wheel itself and the tables around it. Items in the var panel below should only save or update the DOM on an actual save. This was a previous broken behavior
        - DONE (Item 1, option 1A): palette finalize now posts a debounced `liveUpdate` mapping the 6 palette swatches onto the role vars (--ftr10-accent-1..4, --ftr10-surface-1/2) so the workbench recolors live. Note: 1A persists to theme.json (fast path) — "instant" satisfied, strict "not saved" relaxed per chosen option.
- [x] Add a seperate section for the "default cards" it should be obvious to the user that those cards are not sessions
        - Bonus if you make the columns collapsible
        - DONE (Item 2): `buildSessionCardsHtml` now returns { defaults, sessions }; sidebar renders two collapsible `<details class="card-section">` sections ("Default Cards" / "Sessions"). Host `syncSessions` posts `defaultCardsHtml` + `sessionsHtml`; sidebar handler injects both.
- [x] Remove solarized dark, classic night cards.
        - DONE (Item 3): removed `classicNight` + `classicSolarizedDark` imports/entries from `constants.ts` THEME_PRESETS. Preset folders were already absent on disk.
- [x] Restore icon on the default cards does not work, thinking about this more, remove that button all together, and instead if a user changes and saves one of the default (base) cards, make it a session card
        - DONE (Item 4): removed `reset-btn` (render + sidebar handler + `resetBaseSession` + `resetBaseCard` host handling + dead CSS). `saveSession` now sets `isBase: false` and clears `basePresetId` when saving a base card → promoted to a session card.
- [x] var panel in the main architect window is a list of all vars available to the user, there is a simple mode and an advanced mode. When the user saves a card, those values should update automatically to what the user changed. Currently it does not update at all. Previously it updated, but only if you left the session and came back into it, they should show live changes.
        - DONE (Item 5): extracted `applySessionToUI(s, derivedValues)`; `sessionSaved` handler now receives the full `session` from the host and re-renders the Vars panel live (no leave/re-enter needed).

- [ ] Make all buttons appearance look like /steer, /queue
        - Stop button Not theming like the other buttons
        - send, /steer, /queue, /stop, all need uniform font settings, 

## Plan / Execution (implemented)

Decision: Item 1 → **Option 1A** (palette drags post `liveUpdate` fast path; workbench recolors live; persists to theme.json).

### Item 3 — Remove solarized dark + classic night
- `src/theme-sync/constants.ts`: drop `import classicNight` (line 125) and `import classicSolarizedDark` (line 127); remove `classicNight` (line 142) and `classicSolarizedDark` (line 144) from `THEME_PRESETS`.
- Delete unused preset folders: `theme-presets/classic-night/`, `theme-presets/classic-solarized-dark/`.
- Base cards for those two vanish on next `ensureBaseSessions` (no preset → no base card).

### Item 4 — Remove restore button; base→session on save
- `webview-html.ts` `buildSessionCardsHtml` (line 44): remove the `reset-btn` branch for base cards (render only the edit/delete available for sessions; base cards keep edit only).
- Sidebar handler (line 230): drop the `reset-btn` branch.
- `activation.ts`: remove `resetBaseCard` handling (line 175) and `resetBaseSession` (lines 33-50) if nothing else references it.
- `activation.ts` `saveSession` (651-690): when `existing?.isBase` is true, set `isBase: false` and clear `basePresetId` so the saved card becomes a regular session card. Keep delete guard: block deleting `isBase` cards; once converted (isBase false) they become deletable.

### Item 2 — Separate "Default Cards" section (distinct from Sessions)
- `buildSessionCardsHtml`: split into two lists — base cards (`isBase`) → "Default Cards" section; session cards (`!isBase`) → "Sessions" section.
- Bonus: each section column collapsible (use a toggle / `<details>`).
- `base-card` keeps dashed border for visual distinction.

### Item 5 — Var panel live-updates to saved changes
- On `sessionSaved` message (`webview-html.ts` ~2357): reload the saved session's derived values into `varsState.values` (reuse `loadSession` logic at 2315-2356) and call `renderVarsPanel()` so the panel reflects the save immediately without leaving/re-entering.

### Item 1 (1A) — Palette live DOM update
- Palette drag/click currently calls `updateUI(false)` → posts `CodexUpdate` (host only updates sidebar swatches).
- Change palette finalize to also post `liveUpdate` (fast path) so the workbench recolors live. The Architect's own widget already updates live via `updateUI`.
- Note: fast path persists to theme.json (1A tradeoff — "instant" satisfied; "not saved" relaxed). On save (`saveSession`) the card is persisted normally.

## Verification
- `node build.js` compiles clean.
- Reload code-server, open Architect:
  - Drag palette → workbench recolors live (1A).
  - Edit a var → live workbench change; on Save, var panel refreshes to saved values (Item 5).
  - "Default Cards" vs "Sessions" sections render separately and collapse (Item 2).
  - solarized dark / classic night cards gone (Item 3).
  - No restore button on default cards; editing + saving a default card moves it to Sessions (Item 4).

## Complete
- [x] Remove Solarized Light, Vue Green, Github Light
- [x] Evaluate the remaining preview themes and the differences between them

## Notes
- Add important notes here

## Held Items
- [ ] Update documentation: init.md and readme.md (NOTE: The readme has not been updated since the theme engine merged into my markdown previewer)
