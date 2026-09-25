import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
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
            { name: "y-webrtc", message: "Nie importuj y-webrtc bezpośrednio — dozwolone tylko w src/lib/yjsSync.ts." },
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
      "src/lib/yjsSync.ts",
      "src/lib/yjsSync.test.ts",
      "src/hooks/useNotes.ts",
      "src/hooks/useNotes.test.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
);
