# To Do

## Current

## Complete
- [x] Update fonts to only have 1 table, get rid of extra variables (062351b)
        - Removed dead per-area font vars (font-activitybar/sidebar/panel-bottom/panel-top/auxiliarybar) from Typography table, Font Settings section, SELECT_OPTIONS_A, __PANEL_FONT_KEYS. body-font dropped from editable simple table.
        - heading-font + code-font verified wired (preview.less/ThemeCustomizer) and moved into the Text table (items 5-7).
- [x] Check and see where the headers table went — INVESTIGATED: h1-color..h5-color exist and are defined as var(--ftr10-accent-N) in constants.ts; they live in the advanced 'Headings' section and are intentionally computed (derived from accents), not user overrides. Never were in simple mode. OPEN QUESTION for user: surface them in simple mode? (currently advanced-only, by design).
- [x] Fix TH Pace not saving correctly (781bd9d)
        - Root cause in shim.ts applyVars: (1) 'var thpaceOn' hoisting — declared after the early-return that used it, always undefined on skipped path; (2) race — applyVars(__defaultVars) ran before the async Thpace lib loaded, so enable/disable was skipped and never re-triggered → lib fell back to localStorage default (enabled). Fix: __reconcileThpace(resolved) on BOTH paths + 100ms retry until window.ftr10Thpace exists.
- [x] Make the splash screen awesome, >=3s (1862f10)
        - New overlay: radial backdrop, drifting circuit, pulsing glow, dual counter-rotating rings, gradient-shine FTR10 CODEX wordmark, INITIALIZING subtitle, loading bar. MIN_SPLASH_MS=3200 enforced (chrome reveals when built, splash held on top until min time), fallback 4.5s. <!--/ftr10-splash--> marker + legacy-cleanup for re-strippable markup.
- [x] Get rid of tables no longer needed (Palette, Pane Opacity) (df26cf8)
- [x] Combine Text and Fonts into one table (df26cf8) — Text now carries heading-font + code-font (font-aware dropdowns via data-vfont)
- [x] Combine UI, Status Colors, Semantic, Shape into one 'UI' table (df26cf8) — simple mode = Backgrounds, Text, UI, Syntax Tokens
- [x] Redo Backgrounds table (cf1c2ee) — de-duped the Effect dropdown (--ftr10-bg-effect was in both the simple group AND SELECT_OPTIONS_A, producing a second dropdown over the dedicated #bgEffectSelect). NOTE: spec was open-ended; only the concrete duplicate-control bug was addressed — confirm with user if a broader redesign is wanted.

## Complete (prior)
- [x] Change all color pickers to use the new one that palette roles has
- [x] Remove Solarized Light, Vue Green, Github Light
- [x] Evaluate the remaining preview themes and the differences between them
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

## Notes
- Add important notes here

## Held Items
- [ ] Update documentation: init.md and readme.md (NOTE: The readme has not been updated since the theme engine merged into my markdown previewer)
