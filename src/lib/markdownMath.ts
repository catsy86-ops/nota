import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Wtyczki wzorów dla `react-markdown` (plan Notatek 5.4). Osobny moduł, ładowany dynamicznie przez `hasMath`: KaTeX
 * z arkuszem i krojami nie trafia ani do głównej paczki, ani do precache (`vite.config.ts`, `globIgnores`).
 * `throwOnError: false` — błędny wzór pokazuje się czerwonym tekstem źródła zamiast wywalać notatkę;
 * `trust: false` (domyślnie) — bez `\href`, `\includegraphics` i innych poleceń sięgających poza wzór.
 */
export const mathRemarkPlugins = [remarkMath];
export const mathRehypePlugins = [[rehypeKatex, { throwOnError: false, strict: "ignore" }]] as const;
