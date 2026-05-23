import { defineConfig } from "astro/config";

import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://anthropic-hackathon.local",

  server: {
    host: true,
    port: 4321,
  },

  adapter: vercel(),
});