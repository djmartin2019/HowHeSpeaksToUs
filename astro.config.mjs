import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  // Performance optimizations
  compressHTML: true,
  // Enable TypeScript checking
  vite: {
    ssr: {
      noExternal: ["contentful"],
    },
    build: {
      cssMinify: true,
      minify: 'esbuild', // esbuild is faster and built-in with Vite
    },
  },
  // Image optimization
  image: {
    domains: ['images.ctfassets.net'], // Contentful CDN
    remotePatterns: [{ protocol: 'https', hostname: '**.ctfassets.net' }],
  },
});
