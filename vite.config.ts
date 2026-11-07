import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { validateSettings, type AppearanceSettings, type ThemeFolders } from "./config/settings.ts";

const APPEARANCE_MODULE = "virtual:albireo-appearance";
const DARK_THEME_MODULE = "virtual:albireo-dark-theme.css";
const THEME_FILES = ["theme.css", "logo.svg"];

// Builds the look of the library from the appearance settings. The browser app
// imports virtual:albireo-appearance, which loads theme.css of the light theme, then
// theme.css of the dark theme inside a media query for dark mode, and gives the site
// name and the URLs of both logos. The page follows the mode of the device, and
// switches with it at once. The demo (vite.demo.config.ts) builds its look with it too.
export function albireoAppearance(appearance: AppearanceSettings): Plugin {
  const light = themeFolder(appearance.themes, "light");
  const dark = themeFolder(appearance.themes, "dark");
  const darkCss = resolve(dark, "theme.css");
  const resolvedId = `\0${APPEARANCE_MODULE}`;
  const resolvedDarkId = `\0${DARK_THEME_MODULE}`;
  return {
    name: "albireo-appearance",
    resolveId: (source) => (source === APPEARANCE_MODULE ? resolvedId : source === DARK_THEME_MODULE ? resolvedDarkId : undefined),
    load(id) {
      // The variables of the dark theme replace those of the light one while the device is in dark mode.
      if (id === resolvedDarkId) {
        this.addWatchFile(darkCss);
        return `@media (prefers-color-scheme: dark) {\n${readFileSync(darkCss, "utf8")}\n}\n`;
      }
      if (id !== resolvedId) return undefined;
      return [
        `import ${JSON.stringify(resolve(light, "theme.css"))};`,
        `import ${JSON.stringify(DARK_THEME_MODULE)};`,
        `import logo from ${JSON.stringify(resolve(light, "logo.svg"))};`,
        `import darkLogo from ${JSON.stringify(resolve(dark, "logo.svg"))};`,
        `export default { siteName: ${JSON.stringify(appearance.siteName)}, logo, darkLogo };`,
      ].join("\n");
    },
    transformIndexHtml: (html) => html.replace("<title>albireo</title>", `<title>${escapeHtml(appearance.siteName)}</title>`),
  };
}

// The theme folder of a mode of the device, after checking that it has every file of a theme.
function themeFolder(themes: ThemeFolders, mode: keyof ThemeFolders): string {
  const folder = resolve(themes[mode]);
  const missing = THEME_FILES.filter((file) => !existsSync(resolve(folder, file)));
  if (missing.length > 0) {
    throw new Error(`The theme folder ${themes[mode]} (appearance.themes.${mode}) has no ${missing.join(" or ")}.`);
  }
  return folder;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Reads albireo.config.ts each time the server starts. This file does not import it,
// because Vite would then restart on every change of the settings, on top of the
// restart that the Cloudflare plugin makes for the same change, and two restarts at
// once can leave the dev server waiting for modules forever.
async function readAppearance(): Promise<AppearanceSettings> {
  const url = `${pathToFileURL(resolve("albireo.config.ts")).href}?t=${Date.now()}`;
  const settings: { default: unknown } = await import(url);
  return validateSettings(settings.default).appearance;
}

// The Cloudflare plugin reads cloudflare.config.ts, runs the Worker in the
// Workers runtime during `cf dev`, and builds it with the browser app.
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), albireoAppearance(await readAppearance()), cloudflare()],
}));
