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
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false, // Keep console for debugging
        },
      },
    },
  },
  // Image optimization
  image: {
    domains: ['images.ctfassets.net'], // Contentful CDN
    remotePatterns: [{ protocol: 'https', hostname: '**.ctfassets.net' }],
  },
});
