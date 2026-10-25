import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import AstroPWA from "@vite-pwa/astro";

// https://astro.build/config
export default defineConfig({
  // Use static output - API routes handled by Cloudflare Pages Functions
  integrations: [
    tailwind(),
    AstroPWA({
      // Custom service worker (src/sw.ts) so we can use different caching
      // strategies per page type and an offline fallback (and add push later).
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Show a "Refresh" toast instead of swapping versions under the reader.
      registerType: "prompt",
      // We register the SW ourselves in src/components/UpdateToast.astro.
      injectRegister: false,
      manifest: {
        name: "How God Speaks To Us",
        short_name: "God Speaks",
        description:
          "A daily devotional and meditations on God's Word: daily verses, Bible study posts, and sermon resources.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#000000",
        background_color: "#f9fafb",
        lang: "en-US",
        icons: [
          { src: "/pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        // Precache only the app shell and the offline page. Other HTML pages
        // are cached as people visit them (see src/sw.ts).
        globPatterns: [
          "_astro/**/*.{js,css}",
          "js/*.js",
          "*.{png,svg,ico}",
          "offline/index.html",
        ],
        globIgnores: ["howgodspeakstous.png"],
      },
      devOptions: { enabled: false },
    }),
  ],
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
