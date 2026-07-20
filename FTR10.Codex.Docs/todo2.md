The gap is primarily caused by `.center-col` expanding because it contains `#varTables`, which has:

```css
#varTables.draggable {
  position: relative;
  width: 100%;
  max-width: 720px;
}
```

Since `.center-col` is a flex item with an auto width, the variable table can make the center column much wider than the color wheel. The swatch panels remain at the edges of `.panel-row`, creating a large visual gap around the wheel.

There is also a sizing conflict: the two side panels plus the `220px` wheel are wider than the row’s `480px` maximum.

## Recommended fix

Constrain the center column to the wheel/control width and constrain the variable table separately:

```css
.panel-row {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 0;
  width: 100%;
  max-width: 560px;
  margin: 0 auto 18px;
  min-height: 480px;
  overflow: visible;
}

.center-col {
  flex: 0 0 220px;
  width: 220px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 0;
}

#varTables.draggable,
.var-tables {
  width: 100%;
  max-width: 280px;
}
```

You may need a slightly wider row depending on the side panel size:

```css
.panel-row {
  max-width: 540px;
}
```

## Why this works

The layout currently effectively becomes:

```text
left swatch panel + large center-col + right swatch panel
```

instead of:

```text
left swatch panel + 220px wheel column + right swatch panel
```

Setting:

```css
.center-col {
  flex: 0 0 220px;
  width: 220px;
}
```

prevents the variable table from changing the width of the wheel column.

## Also check the perspective transforms

These transforms move the electric-panel wrappers horizontally:

```css
.ep-wrap.left {
  transform: perspective(420px) rotateY(22deg) rotateZ(-1deg) translateX(31px);
}

.ep-wrap.right {
  transform: perspective(420px) rotateY(-22deg) rotateZ(1deg) translateX(-31px);
}
```

They move the left panel right and the right panel left, so they are intended to bring the panels toward the wheel. However, the `rotateY()` transform can visually distort the panels and make the spacing appear inconsistent.

For testing, temporarily remove the translations and rotations:

```css
.ep-wrap.left,
.ep-wrap.right {
  transform: none;
}
```

If the panels immediately appear correctly positioned, use smaller transforms:

```css
.ep-wrap.left {
  transform: perspective(420px) rotateY(12deg) translateX(12px);
}

.ep-wrap.right {
  transform: perspective(420px) rotateY(-12deg) translateX(-12px);
}
```

## Likely final CSS adjustment

I would start with this:

```css
.panel-row {
  max-width: 540px;
}

.center-col {
  flex: 0 0 220px;
  width: 220px;
  min-width: 220px;
}

#varTables.draggable,
.var-tables {
  width: 100%;
  max-width: 280px;
}

.ep-wrap.left {
  transform: perspective(420px) rotateY(12deg) rotateZ(-1deg) translateX(12px);
}

.ep-wrap.right {
  transform: perspective(420px) rotateY(-12deg) rotateZ(1deg) translateX(-12px);
}
```

The most important change is constraining `.center-col`; the large `#varTables` width is the part most likely creating the unexpected gap.