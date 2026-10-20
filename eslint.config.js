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
      "src/lib/yjsStore.test.ts",
      // Właściwości notatek: test synchronizacji dwóch dokumentów (Y.applyUpdate) i ręczny Y.Map w uszkodzonym wpisie.
      "src/lib/yjsStore.props.test.ts",
      "src/lib/yTextEdit.ts",
      "src/lib/yTextEdit.test.ts",
      "src/lib/yjsSync.ts",
      "src/lib/yjsSync.test.ts",
      "src/lib/imageSync.ts",
      "src/lib/imageSync.test.ts",
      "src/lib/shifts/yShifts.ts",
      "src/lib/shifts/yShifts.test.ts",
      // Premie: test synchronizacji w dokumencie Yjs (ten sam wzorzec co yShifts).
      "src/lib/shifts/bonus.test.ts",
      "src/lib/study/yStudy.ts",
      "src/lib/study/yStudy.test.ts",
      // Odżywki: warstwa Yjs w dokumencie notatek (wzorem yStudy/yDebts), testy na własnym Y.Doc.
      "src/lib/supplements/ySupplements.ts",
      "src/lib/supplements/ySupplements.test.ts",
      // Dieta: warstwa Yjs w dokumencie notatek (ten sam wzorzec), testy na własnym Y.Doc.
      "src/lib/diet/yDiet.ts",
      "src/lib/diet/yDiet.test.ts",
      // Trening: warstwa Yjs w dokumencie notatek (ten sam wzorzec), testy na własnym Y.Doc.
      "src/lib/training/yTraining.ts",
      "src/lib/training/yTraining.test.ts",
      "src/lib/training/reminder.test.ts",
      // Długi: warstwa Yjs (ten sam wzorzec co pozostałe działy), testy na własnym Y.Doc.
      "src/lib/debts/yDebts.ts",
      "src/lib/debts/yDebts.test.ts",
      "src/lib/debts/yDebts.edit.test.ts",
      "src/lib/tabSync.ts",
      "src/lib/tabSync.test.ts",
      // Buduje plik synchronizacji w starym formacie jako dane testowe.
      "e2e/images.spec.ts",
      "src/hooks/useNotes.ts",
      "src/hooks/useNotes.test.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
