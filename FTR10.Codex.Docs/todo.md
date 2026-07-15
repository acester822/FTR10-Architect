# To Do
320
## Current
- [ ] Remove Dark Material, Github Dark, One Dark
- [ ] Compare the themes in theme-sync.ts, and remove themes that are too similar, Several of them have color palletts that are very similar
    - Remove the identified themes from theme-sync.ts and update the package.json
- [ ] Update the remaining themes to each have a specific and different color pallett and settings, define fonts, add unique settings to each one that compliment the theme and background
- [ ] Tweak THPace color selectors to be darker, setting THPace Accent 2 to transparent accomplishes this    

## Complete
- [x] Remove Solarized Light, Vue Green, Github Light
- [x] Evaluate the remaining preview themes and the differences between them

## Theme evaluation
- Removed preview options: `solarized-light.css`, `vue.css`, `github-light.css`.
- Kept a tighter, more coherent theme set with stronger contrast and fewer duplicate light variants.
- Light preview themes now focus on `atom-light.css` and `one-light.css`.
- Dark preview themes now include `atom-dark.css`, `github-dark.css`, `monokai.css`, `night.css`, `one-dark.css`, `solarized-dark.css`, and accent-forward options like `atom-material.css`, `gothic.css`, `medium.css`, and `aces-codepunk.css`.
- This keeps the remaining themes distinct and easier to evaluate for future pruning.