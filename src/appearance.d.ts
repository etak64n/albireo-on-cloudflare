// The look of the library, built by the albireo-appearance plugin in vite.config.ts
// from the appearance settings in albireo.config.ts.
declare module "virtual:albireo-appearance" {
  const appearance: {
    /** The name of the library. */
    siteName: string;
    /** URL of logo.svg of the light theme, which is also the favicon. */
    logo: string;
    /** URL of logo.svg of the dark theme, for pages in dark mode. */
    darkLogo: string;
  };
  export default appearance;
}
