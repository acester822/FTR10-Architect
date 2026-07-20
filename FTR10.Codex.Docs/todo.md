# To Do

## Current
- [ ] Update fonts to only have 1 table, get rid of extra variables
        -  Remove from typography table (duplicates, values captured in Fonts table)
                - font-activitybar
                - font-sidebar
                - font-panel-bottom
                - font-panel-top
                - font-auxiliarybar
                - body-font (not needed)
        -  Move heading-font and code-font to the fonts table (verify if those are even wired to anything first)

- [ ] Change all color pickers to use the new one that palette roles has  

- [ ] Check and see where the headers table went, I think some variables got left off, this could be because they are computed values only, should these have overrides?

- [ ] Fix TH Pace not saving correctly, gui shows it as enabled, but it does not enable

- [ ] Make the splash screen awesome, make it at minimum 3 seconds long

- [ ] Get rid of tables that are no longer needed or captured in other tables
        - Palette
        - Pane Opacity

- [ ] Combine Text and Fonts into one table

- [ ] Combine UI, Status Colors, Semantic (what even is this??), and Shape into one table named UI

- [ ] Redo Backgrounds table - 


## Complete
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
