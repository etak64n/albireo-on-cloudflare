---
title: "Themes"
description: "The colors, corners, shadows, fonts, and logo of the library."
---

A theme is a folder with two files: theme.css for the colors, corners, shadows, and fonts, and logo.svg for the logo.
`appearance.themes` names two folders: `light` while the device is in light mode, and `dark` while it is in dark mode.
albireo includes `./themes/light` and `./themes/dark`.
The page follows the mode of the device and switches with it at once, without a reload. The same folder in both keeps one look.

theme.css sets these variables in `:root`, and src/styles.css turns them into the styles of the app.
The build puts theme.css of the dark theme inside a media query for dark mode, so theme.css holds rules only, without `@import`.

- Accent: `--theme-accent`, `--theme-accent-hover`, `--theme-accent-subtle`, `--theme-on-accent`, and `--theme-focus-ring`
- Text: `--theme-text-heading`, `--theme-text-strong`, `--theme-text-control`, `--theme-text`, `--theme-text-label`, `--theme-text-subdued`, and `--theme-text-placeholder`
- Surfaces and lines: `--theme-surface`, `--theme-surface-subdued`, `--theme-surface-hover`, `--theme-border`, and `--theme-hairline`
- Status: `--theme-positive` and `--theme-critical`
- Labels over pictures and the shade under dialogs: `--theme-overlay`, `--theme-on-overlay`, and `--theme-scrim`
- Corners: `--theme-radius-xs`, `--theme-radius-sm`, `--theme-radius-md`, `--theme-radius-lg`, and `--theme-radius-xl`
- Shadows of what floats over the page: `--theme-shadow-tooltip` and `--theme-shadow-popover`
- Fonts: `--theme-font` and `--theme-font-mono`

The sidebar shows the logo of the theme that matches the mode. The icon of the browser tab holds both logos and shows the one that matches the mode of the browser, since a dark tab hides a dark logo. It shows the middle of the logo 1.3 times as large, so that the mark reads at the 16 pixels of a tab, and the edges of the logo are cut (vite.config.ts).
When either file is missing, `cf dev` and the build stop with an error, so a typo in the path does not ship an unstyled library (vite.config.ts).

To make a theme of your own, copy themes/light to a folder of yours, change the values and the logo, and point `appearance.themes.light` or `appearance.themes.dark` at the folder.
