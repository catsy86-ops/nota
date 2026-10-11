/**
 * Callouty i bloki zwijane w składni Obsidiana/GitHuba, bez surowego HTML:
 *
 *   > [!info] Tytuł          — wyróżniony blok (info, tip, warning, danger)
 *   > treść
 *
 *   > [!toggle]- Tytuł       — blok zwijany, domyślnie zwinięty (`+` = rozwinięty)
 *   > treść
 *
 * W innych edytorach to po prostu cytat z nagłówkiem `[!typ]`, więc treść się nie gubi.
 * Wtyczka remark przekształca `blockquote` w `div` z atrybutami `data-*`, a renderer
 * (`MarkdownRendererImpl`) zamienia go na gotowy komponent.
 */
export type CalloutKind = "info" | "tip" | "warning" | "danger" | "toggle";

const ALIASES: Record<string, CalloutKind> = {
  info: "info", note: "info", notatka: "info",
  tip: "tip", wskazowka: "tip", "wskazówka": "tip", hint: "tip",
  warning: "warning", uwaga: "warning", ostrzezenie: "warning", "ostrzeżenie": "warning",
  danger: "danger", wazne: "danger", "ważne": "danger", blad: "danger", "błąd": "danger",
  toggle: "toggle", zwin: "toggle", "zwiń": "toggle", details: "toggle", szczegoly: "toggle", "szczegóły": "toggle",
};

export function calloutKind(name: string): CalloutKind | null {
  return ALIASES[name.toLowerCase()] ?? null;
}

/** `[!typ]`, opcjonalnie `+`/`-` (rozwinięty/zwinięty), potem tytuł do końca linii. */
const HEAD_RX = /^\[!([\p{L}]+)\]([+-]?)[ \t]*([^\n]*)/u;

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, string> };
}

function convertBlockquote(node: MdNode): void {
  const para = node.children?.[0];
  if (!para || para.type !== "paragraph") return;
  const first = para.children?.[0];
  if (!first || first.type !== "text" || typeof first.value !== "string") return;
  const m = HEAD_RX.exec(first.value);
  if (!m) return;
  const kind = calloutKind(m[1]);
  if (!kind) return;

  const collapse = m[2] === "-" ? "closed" : m[2] === "+" ? "open" : kind === "toggle" ? "closed" : "";
  const title = m[3].trim();

  // Znacznik i tytuł znikają z treści; reszta po pierwszej linii zostaje.
  const rest = first.value.slice(m[0].length).replace(/^\n/, "");
  if (rest) first.value = rest;
  else para.children!.shift();
  if (para.children!.length === 0) node.children!.shift();

  node.data = {
    hName: "div",
    hProperties: { "data-callout": kind, "data-collapse": collapse, "data-title": title },
  };
}

function walk(node: MdNode): void {
  if (node.type === "blockquote") convertBlockquote(node);
  if (node.children) for (const child of node.children) walk(child);
}

/** Wtyczka remark (`remarkPlugins={[remarkCallouts]}`). */
export function remarkCallouts() {
  return (tree: MdNode) => walk(tree);
}
