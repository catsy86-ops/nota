import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";

// Identyfikator builda do raportu diagnostycznego: commit + data budowania.
function buildId(): string {
  let sha = "nogit";
  try { sha = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* poza repo */ }
  return `${sha} ${new Date().toISOString().slice(0, 16)}`;
}

// Preload fontu tekstu (podzbiory łacińskie — polski siedzi w latin-ext): bez tego przeglądarka
// odkrywa woff2 dopiero po sparsowaniu CSS, a tekst do tego czasu jest w foncie zastępczym.
function preloadTextFont(): Plugin {
  return {
    name: "preload-text-font",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        return Object.keys(ctx.bundle)
          .filter((f) => /plus-jakarta-sans-latin(-ext)?-wght-normal-[\w-]+\.woff2$/.test(f))
          .map((f) => ({ tag: "link", attrs: { rel: "preload", as: "font", type: "font/woff2", href: `/${f}`, crossorigin: "" }, injectTo: "head" as const }));
      },
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
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
    preloadTextFont(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      manifest: false,
      // Bez `includeAssets`: ikony i offline.html z `public/` łapie już `globPatterns` niżej — oba naraz
      // dublowały je w liście precache sw.js (6 plików, ok. 0,3 MB liczone podwójnie).
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        // Manifest-only asset: fetched by the OS install UI, never by the app
        // itself — keep it out of the offline-critical precache.
        // Fonty: offline potrzebne są tylko podzbiory łacińskie (polski siedzi
        // w latin-ext); cyrylica/greka/wietnamski i tak ładują się tylko na żądanie.
        // Kroje stylów (Plan, Neon, Zorza, Miedź) i kroje tekstu do wyboru poza precache — pobiera je dopiero wybrany styl,
        // potem trzyma `skin-fonts` niżej. Logo „G” używa Unbounded latin (wght), więc ten plik zostaje w precache.
        globIgnores: [
          "**/screenshot-wide.png",
          "**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2",
          "**/{barlow-condensed,fraunces,bricolage-grotesque,inter,nunito,atkinson-hyperlegible-next,literata,manrope,lexend}-*.woff2",
          "**/unbounded-latin-ext*.woff2",
          // Eksport PDF (jsPDF + html2canvas + purify + index.es) i Statystyki: ~1,1 MB, rzadko używane.
          // Nie w precache — trafiają do cache `static-assets` przy pierwszym użyciu (offline wcześniej: błąd).
          "**/{exportPdf,index.es,html2canvas,html2canvas.esm,purify.es,StatsDialog}-*.js",
          // Edytor CodeMirror (~500 KB) za flagą `cmEditor`: tylko na żądanie, poza precache (plan rozbudowy, Faza 1a).
          "**/CmEditor-*.js",
        ],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        importScripts: ["sw-notifications.js", "sw-share.js"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(barlow-condensed|fraunces|bricolage-grotesque|unbounded-latin|inter|nunito|atkinson-hyperlegible-next|literata|manrope|lexend)-[^/]*\.woff2$/.test(url.pathname),
            handler: "CacheFirst",
            options: { cacheName: "skin-fonts", expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ request }) => request.mode === "navigate",
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
    rolldownOptions: {
      output: {
        // Vite 8 (rolldown): `codeSplitting` zamiast `manualChunks`. Grupy dopasowane po ścieżce w node_modules.
        // React 19: renderer w `react-dom/client` (samo `react-dom` to cienka nakładka).
        // Bez „vendor-motion”: ręczna paczka wciągnęłaby całe framer-motion (z `domMax`) do startu; LazyMotion (App.tsx)
        // ładuje funkcje animacji osobno.
        // Deliberately no "vendor-pdf": jspdf is reachable only through the dynamic import() in exportPdf.ts. Forcing it
        // into a manual chunk made the shared __vitePreload helper land there too, so the main chunk got a *static*
        // import of vendor-pdf and the browser modulepreloaded all 391 KB of jsPDF on every page load.
        // minSize: rolldown dzieli startowy kod na wiele drobnych chunków (każdy z narzutem); scalamy je z sąsiadami.
        codeSplitting: {
          minSize: 20_000,
          groups: [
            { name: "vendor-react", test: /[/\\]node_modules[/\\](react|react-dom|scheduler|react-router|react-router-dom)[/\\]/ },
            { name: "vendor-dnd", test: /[/\\]node_modules[/\\]@dnd-kit[/\\]/ },
            { name: "vendor-radix", test: /[/\\]node_modules[/\\]@radix-ui[/\\]/ },
          ],
        },
      },
    },
  },
}));
