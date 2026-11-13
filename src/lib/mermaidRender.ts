/**
 * Diagramy Mermaid w notatkach (plan Notatek 5.5). Cały moduł (i sama biblioteka `mermaid`) ładuje się dynamicznie,
 * dopiero gdy w notatce jest blok ` ```mermaid `; biblioteka leży w `public/mermaid/` (poza paczką i precache).
 */

type Mermaid = (typeof import("mermaid"))["default"];

/**
 * Wersja Mermaida w `public/mermaid/<wersja>/` (kopiuje `scripts/copy-mermaid.mjs`). Musi być równa wersji z
 * `package.json` — pilnuje tego `mermaidRender.test.ts`.
 */
export const MERMAID_VERSION = "12.3.0";
const MERMAID_URL = `/mermaid/${MERMAID_VERSION}/mermaid.esm.min.mjs`;

let loading: Promise<Mermaid> | null = null;
let counter = 0;
/** Mermaid działa na globalnym DOM i globalnej konfiguracji, więc rysujemy po jednym diagramie naraz. */
let queue: Promise<unknown> = Promise.resolve();

function loadMermaid(): Promise<Mermaid> {
  // Z własnego adresu, poza paczką Vite (`@vite-ignore`): biblioteka i jej chunki nie wchodzą do precache.
  loading ??= (import(/* @vite-ignore */ MERMAID_URL) as Promise<{ default: Mermaid }>).then((m) => m.default).catch((e) => { loading = null; throw e; });
  return loading;
}

/** Kolor z tokenu motywu jako `#rrggbb` (Mermaid nie rozumie `oklch()` ani `color-mix()`). */
export function resolveTokenColor(token: string, fallback: string): string {
  try {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    probe.style.display = "none";
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.fillStyle = "#000";
    ctx.fillStyle = resolved;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return fallback;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return fallback;
  }
}

function themeVariables() {
  const dark = document.documentElement.classList.contains("dark");
  const fg = resolveTokenColor("--foreground", dark ? "#eeeeee" : "#222222");
  const bg = resolveTokenColor("--background", dark ? "#111111" : "#ffffff");
  const card = resolveTokenColor("--card", dark ? "#1b1b1b" : "#ffffff");
  const muted = resolveTokenColor("--muted", dark ? "#262626" : "#f1f1f1");
  const line = resolveTokenColor("--muted-foreground", dark ? "#aaaaaa" : "#666666");
  const primary = resolveTokenColor("--primary", "#d98324");
  return {
    dark,
    vars: {
      background: bg,
      primaryColor: card,
      primaryTextColor: fg,
      primaryBorderColor: primary,
      secondaryColor: muted,
      tertiaryColor: bg,
      lineColor: line,
      textColor: fg,
      mainBkg: card,
      nodeBorder: primary,
      clusterBkg: muted,
      clusterBorder: line,
      edgeLabelBackground: bg,
      fontFamily: "inherit",
    },
  };
}

export type MermaidResult = { ok: true; svg: string } | { ok: false; error: string };

/** Rysuje diagram w aktualnym motywie. Błąd składni wraca jako wynik (nie wyjątek), z pierwszą linią komunikatu. */
export function renderMermaid(source: string): Promise<MermaidResult> {
  const run = async (): Promise<MermaidResult> => {
    try {
      const mermaid = await loadMermaid();
      const { dark, vars } = themeVariables();
      mermaid.initialize({
        startOnLoad: false,
        // `strict`: Mermaid czyści etykiety (DOMPurify), wyłącza `click` i HTML w etykietach — treść notatki bywa od peera.
        securityLevel: "strict",
        suppressErrorRendering: true,
        theme: "base",
        darkMode: dark,
        themeVariables: vars,
      });
      await mermaid.parse(source);
      const { svg } = await mermaid.render(`mmd-${++counter}`, source);
      return { ok: true, svg };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { ok: false, error: message.split("\n").find((l) => l.trim()) ?? "Błąd składni diagramu" };
    }
  };
  const next = queue.then(run, run);
  queue = next;
  return next;
}
