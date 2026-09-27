import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";

// Identyfikator builda do raportu diagnostycznego: commit + data budowania.
function buildId(): string {
  let sha = "nogit";
  try { sha = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* poza repo */ }
  return `${sha} ${new Date().toISOString().slice(0, 16)}`;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD__: JSON.stringify(buildId()),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      includeAssets: ["favicon.png", "apple-touch-icon.png", "pwa-192.png", "pwa-512.png", "pwa-512-maskable.png", "offline.html"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Manifest-only asset: fetched by the OS install UI, never by the app
        // itself — keep it out of the offline-critical precache.
        globIgnores: ["**/screenshot-wide.png"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        importScripts: ["sw-notifications.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
              precacheFallback: { fallbackURL: "/offline.html" },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\/assets\/.*\.(?:js|css|woff2?|png|svg|jpg|jpeg|webp)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === "image" || request.destination === "font"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "media-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
          // Deliberately no "vendor-pdf": jspdf is reachable only through the
          // dynamic import() in exportPdf.ts, so Rollup isolates it in that
          // async chunk on its own. Forcing it into a manual chunk made the
          // shared __vitePreload helper land there too, which gave the main
          // chunk a *static* import of vendor-pdf — the browser then
          // modulepreloaded all 391 KB of jsPDF on every page load.
          "vendor-radix": [
            "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-popover",
            "@radix-ui/react-tooltip", "@radix-ui/react-alert-dialog",
          ],
        },
      },
    },
  },
}));
