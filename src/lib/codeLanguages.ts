import { LanguageDescription, type LanguageSupport } from "@codemirror/language";

/**
 * Języki bloków kodu w notatkach (plan Notatek 5.3): jedna lista dla edytora (`markdown({ codeLanguages })`)
 * i czytnika (`codeHighlight.ts`, ta sama gramatyka Lezer). Każdy język to osobny `import()`, więc pobiera się
 * dopiero przy pierwszym bloku w tym języku; paczki są w grupie `codelang` poza precache (`vite.config.ts`).
 * Zamiast pełnego `@codemirror/language-data` (kilkadziesiąt języków, w tym stare tryby) jest krótka lista tego,
 * co realnie ląduje w notatkach: strony, dane i skrypty.
 */
const lang = (name: string, alias: string[], extensions: string[], load: () => Promise<LanguageSupport>) =>
  LanguageDescription.of({ name, alias, extensions, load });

export const CODE_LANGUAGES: LanguageDescription[] = [
  lang("JavaScript", ["js", "mjs", "cjs", "node"], ["js", "mjs", "cjs"], () => import("@codemirror/lang-javascript").then((m) => m.javascript())),
  lang("JSX", ["jsx"], ["jsx"], () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true }))),
  lang("TypeScript", ["ts"], ["ts", "mts", "cts"], () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true }))),
  lang("TSX", ["tsx"], ["tsx"], () => import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true, jsx: true }))),
  lang("JSON", ["json", "jsonc"], ["json"], () => import("@codemirror/lang-json").then((m) => m.json())),
  lang("CSS", ["css"], ["css"], () => import("@codemirror/lang-css").then((m) => m.css())),
  lang("HTML", ["html", "htm"], ["html", "htm"], () => import("@codemirror/lang-html").then((m) => m.html())),
  lang("XML", ["xml", "svg", "xsd"], ["xml", "svg"], () => import("@codemirror/lang-xml").then((m) => m.xml())),
  lang("SQL", ["sql"], ["sql"], () => import("@codemirror/lang-sql").then((m) => m.sql())),
  lang("Python", ["python", "py"], ["py"], () => import("@codemirror/lang-python").then((m) => m.python())),
  lang("YAML", ["yaml", "yml"], ["yaml", "yml"], () => import("@codemirror/lang-yaml").then((m) => m.yaml())),
];
