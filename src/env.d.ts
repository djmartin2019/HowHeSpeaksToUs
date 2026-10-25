/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite-plugin-pwa/client" />

// iOS Safari only: true when running from the home screen.
interface Navigator {
  standalone?: boolean;
}
