import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // .claude/ trzyma worktree agentów (osobne kopie repo) — lintuje się je w ich własnym katalogu.
  { ignores: ["dist", "coverage", ".claude"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // BOM przesunięty przez wstawioną linię do środka pliku zatrzymał CI na dobę (23.11); żaden plik go nie ma.
      "unicode-bom": ["error", "never"],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "yjs", message: "Nie importuj yjs bezpośrednio — użyj src/hooks/useNotes.ts / NotesProvider." },
            { name: "y-indexeddb", message: "Nie importuj y-indexeddb bezpośrednio — dozwolone tylko w src/lib/yjsStore.ts." },
            { name: "y-webrtc", message: "Nie importuj y-webrtc bezpośrednio — dozwolone tylko w src/lib/yjsSync.ts i src/lib/imageSync.ts." },
          ],
        },
      ],
    },
  },
  {
    // Only these modules (and their tests) are allowed to talk to Yjs directly.
    files: [
      "src/lib/yjsStore.ts",
      // F3: części magazynu wydzielone z yjsStore.ts.
      "src/lib/yjs/*.ts",
      "src/lib/yjsStore.test.ts",
      // Właściwości notatek: test synchronizacji dwóch dokumentów (Y.applyUpdate) i ręczny Y.Map w uszkodzonym wpisie.
      "src/lib/yjsStore.props.test.ts",
      "src/lib/yTextEdit.ts",
      "src/lib/yTextEdit.test.ts",
      // Test limitów scalania: dwa dokumenty Yjs i Y.applyUpdate.
      "src/lib/study/mergeLimits.test.ts",
      // Z-11: Praca na dwóch dokumentach Yjs bez łączności.
      "src/lib/study/concurrency.test.ts",
      "src/lib/yjsSync.ts",
      "src/lib/yjsSync.test.ts",
      "src/lib/deviceRegistry.test.ts",
      "src/lib/migrations/runner.ts",
      "src/lib/migrations/patterns.ts",
      "src/lib/migrations/patterns.test.ts",
      "src/lib/migrations/registry.ts",
      "src/lib/migrations/runner.test.ts",
      "src/test/fixtures/docs/*.test.ts",
      // Z-17.9: pomocnik zestawu zbieżności i jego test na atrapie — repliki to dokumenty Yjs.
      "src/test/convergence.ts",
      "src/test/convergence.test.ts",
      "src/lib/imageSync.ts",
      "src/lib/imageSync.test.ts",
      "src/lib/shifts/yShifts.ts",
      "src/lib/shifts/yShifts.test.ts",
      // Analizator planów: mapa `plans` (wzór yPoints) i jej test scalania dwóch dokumentów.
      "src/lib/plans/yPlans.ts",
      "src/lib/plans/yPlans.test.ts",
      // Zapisane widoki (nowy plan 6.1): mapa `views` (jedna wartość LWW na widok) i test projekcji.
      "src/lib/savedViews.ts",
      "src/lib/savedViews.test.ts",
      // Premie: test synchronizacji w dokumencie Yjs (ten sam wzorzec co yShifts).
      "src/lib/shifts/bonus.test.ts",
      // Wiele grafików: rejestr i test izolacji (ten sam dokument Yjs co grafik).
      "src/lib/shifts/schedules.ts",
      "src/lib/shifts/schedules.test.ts",
      // Przekaźnik E2E: szyfrowany transport `Y.Doc` (kodowanie stanu i scalanie aktualizacji), testy na własnym dokumencie.
      "src/lib/sync/relayProvider.ts",
      "src/lib/sync/relayProvider.test.ts",
      "src/lib/sync/relayRollback.test.ts",
      "src/lib/sync/relayServer.integration.test.ts",
      // Wymiana kodu: znacznik w mapie `syncControl` budowany w osobnym `Y.Doc`, kontrola nowego pokoju w dokumencie pomocniczym.
      "src/lib/sync/rekey.ts",
      "src/lib/sync/rekey.test.ts",
      "src/lib/sync/rekeyRelay.ts",
      // Masa ciała (C-2): warstwa Yjs w dokumencie notatek (wzorem diety), testy na własnym Y.Doc.
      "src/lib/weight/yWeight.ts",
      "src/lib/weight/yMeasures.ts",
      "src/lib/weight/yMeasures.test.ts",
      "src/lib/weight/yWeight.test.ts",
      "src/lib/study/yStudy.ts",
      "src/lib/study/yStudy.test.ts",
      "src/lib/study/properties.prop.test.ts",
      // Odżywki: warstwa Yjs w dokumencie notatek (wzorem yStudy/yDebts), testy na własnym Y.Doc.
      "src/lib/supplements/ySupplements.ts",
      "src/lib/supplements/ySupplements.test.ts",
      // Dieta: warstwa Yjs w dokumencie notatek (ten sam wzorzec), testy na własnym Y.Doc.
      "src/lib/diet/yDiet.ts",
      // Faktury KSeF: niezmienne rekordy w mapie Yjs i test scalania dwóch dokumentów.
      "src/lib/ksef/yInvoices.ts",
      "src/lib/ksef/invoices.test.ts",
      "src/lib/diet/yDiet.test.ts",
      // Trening: warstwa Yjs w dokumencie notatek (ten sam wzorzec), testy na własnym Y.Doc.
      "src/lib/training/yTraining.ts",
      "src/lib/training/yTraining.test.ts",
      "src/lib/training/reminder.test.ts",
      "src/lib/training/reminderRestore.test.ts",
      "src/lib/yjsStore.reminder.test.ts",
      // Długi: warstwa Yjs (ten sam wzorzec co pozostałe działy), testy na własnym Y.Doc.
      "src/lib/debts/yDebts.ts",
      // Kartoteka klientów: warstwa Yjs w dokumencie notatek (wzorem yDebts), test na własnym Y.Doc.
      "src/lib/clients/yClients.ts",
      "src/lib/clients/clients.test.ts",
      "src/lib/debts/yDebts.test.ts",
      "src/lib/debts/yDebts.edit.test.ts",
      // L1.2: własności Długów na dokumencie Yjs.
      "src/lib/debts/properties.prop.test.ts",
      "src/lib/debts/yDebts.extra.test.ts",
      "src/lib/debts/plans.test.ts",
      "src/lib/docReplace.test.ts",
      "src/lib/supplements/extra.test.ts",
      "src/lib/supplements/takeFlow.test.ts",
      "src/lib/training/extra.test.ts",
      "src/lib/study/extra.test.ts",
      // Lista przed wejściem na budowę: warstwa Yjs poza paczką startową (wzorem yDebts).
      "src/lib/study/yEntryCheck.ts",
      "src/lib/study/yEntryCheck.test.ts",
      "src/lib/study/yKits.ts",
      "src/lib/study/yPoints.ts",
      "src/lib/study/yBilling.ts",
      "src/lib/study/yJobs.ts",
      "src/lib/study/yPricing.ts",
      "src/lib/study/pricingStore.test.ts",
      "src/lib/study/quoteTemplates.test.ts",
      "src/lib/study/quoteDoc.test.ts",
      "src/lib/study/yVan.ts",
      "src/lib/study/van.test.ts",
      "src/lib/study/jobs.test.ts",
      "src/lib/study/billing.test.ts",
      "src/lib/study/points.test.ts",
      "src/lib/study/kits.test.ts",
      // Cofnij w Grafiku: test na własnym Y.Doc (ten sam wzorzec co pozostałe działy).
      "src/lib/shifts/undo.test.ts",
      "src/lib/shifts/leaveHours.test.ts",
      "src/lib/tabSync.ts",
      "src/lib/tabSync.test.ts",
      // Zgodność ze starszą wersją (Plan-nowy 1.4): „stary klient” pisze surowymi operacjami Yjs.
      "src/lib/dataCompat.test.ts",
      // D1.3: wymaganie wersji w dokumencie — scalanie dwóch dokumentów.
      "src/lib/docFormat.test.ts",
      // D1.1: nieznane pola Ćwiczeń — wpisy wstawiane prosto do map Yjs.
      "src/lib/exerciseExtra.test.ts",
      // D1.1: nieznane pola Pracy — wpisy wstawiane prosto do map Yjs.
      "src/lib/study/extraD11.test.ts",
      // L4.3: dowody długów — mapa Yjs w teście.
      "src/lib/debts/proofs.test.ts",
      // D1.1: Grafik, trening, foldery, właściwości — mapy Yjs w teście.
      "src/lib/extraD11rest.test.ts",
      // D1.1: plany i listy budów — mapy Yjs w teście.
      "src/lib/extraD11plans.test.ts",
      // Buduje plik synchronizacji w starym formacie jako dane testowe.
      "e2e/images.spec.ts",
      "src/hooks/useNotes.ts",
      "src/hooks/useNotes.test.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Warstwy (plan A1.6): lib ← hooks ← components. `lib` nie zna interfejsu; `sonner` tylko przez `lib/notify.ts`.
    // Importy dynamiczne (`import()`) są dozwolone — tak ładuje się widoki w `viewPreload.ts`.
    files: ["src/lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "src/lib/notify.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^@.(hooks|components).+/], ExportNamedDeclaration[source.value=/^@.(hooks|components).+/]",
          message: "`src/lib` nie importuje z hooks ani components (warstwy lib ← hooks ← components). Przenieś typ lub funkcję do `lib`.",
        },
        {
          selector: "ImportDeclaration[source.value='sonner']",
          message: "Importuj `toast` z `@/lib/notify`, nie z `sonner`.",
        },
      ],
    },
  },
  {
    // Hooki nie importują komponentów (plan A1.5, wyjątki zeszły do zera 2026-11-25). Typy wspólne: `lib/composerTypes.ts`,
    // bramka potwierdzeń: `lib/confirmGate.ts`; hooki renderujące toasty z komponentami są kontrolerami w `src/components/`.
    files: ["src/hooks/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^@.components.+/]",
          message: "Hooki nie importują komponentów (warstwy lib ← hooks ← components).",
        },
      ],
    },
  },
  {
    // S1.2 (plan bezpieczeństwa): połączenia z serwerami użytkownika i własnymi plikami tylko przez
    // src/lib/net/endpoints.ts (endpointFetch, endpointSocket, sameOriginFetch) — tam jest sprawdzanie adresów.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/net/endpoints.ts", "src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Użyj endpointFetch albo sameOriginFetch z @/lib/net/endpoints (S1.2)." },
        { name: "WebSocket", message: "Użyj endpointSocket z @/lib/net/endpoints (S1.2)." },
        { name: "EventSource", message: "Połączenia sieciowe tylko przez @/lib/net/endpoints (S1.2)." },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) => ["fetch", "WebSocket", "EventSource"].map((property) => ({
          object, property, message: "Połączenia sieciowe tylko przez @/lib/net/endpoints (S1.2).",
        }))),
        { object: "navigator", property: "sendBeacon", message: "Połączenia sieciowe tylko przez @/lib/net/endpoints (S1.2)." },
      ],
    },
  },
  {
    // Praca (B1.5): części fasady `store.ts` nie importują fasady z powrotem — to cykl modułów.
    files: [
      "src/lib/study/learnActions.ts",
      "src/lib/study/journalActions.ts",
      "src/lib/study/siteActions.ts",
      "src/lib/study/studyProjection.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "yjs", message: "Nie importuj yjs bezpośrednio — użyj src/hooks/useNotes.ts / NotesProvider." },
            { name: "./store", message: "Część fasady nie importuje fasady (cykl): użyj ./studyProjection." },
            { name: "@/lib/study/store", message: "Część fasady nie importuje fasady (cykl): użyj ./studyProjection." },
          ],
        },
      ],
    },
  },
);
