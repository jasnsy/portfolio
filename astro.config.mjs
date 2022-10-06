import tailwind from "@astrojs/tailwind";
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  site: "https://jasnsy.github.io",
  base: "/portfolio",
  integrations: [tailwind()],
  vite: {
    ssr: {
      external: ["@11ty/eleventy-img", "svgo"]
    }
  },
});