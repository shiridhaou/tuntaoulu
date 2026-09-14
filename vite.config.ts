// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      // The client bundle (what browsers fetch) is emitted to dist/client.
      outDir: "dist/client",
      devOptions: { enabled: false },
      manifest: false, // public/manifest.json is maintained by hand
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,ico,json}"],
        navigateFallback: "/",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // HTML navigations: always try the network first so LAN clients
            // pick up fresh pages, falling back to cache when offline.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "tuntaolu-pages",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === "font" || request.destination === "image"),
            handler: "CacheFirst",
            options: {
              cacheName: "tuntaolu-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
