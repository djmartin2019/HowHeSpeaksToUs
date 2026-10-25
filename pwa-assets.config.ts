// Generates PWA icons from public/icon.svg. Run with: npm run icons
import { defineConfig, minimal2023Preset } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: "#ffffff" } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: "#ffffff" } },
  },
  images: ["public/icon.svg"],
});
