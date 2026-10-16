/**
 * HTML ze schowka → Markdown dla wklejania w kompozytorze. Obsługuje to, co zwykle kopiuje się
 * ze stron i dokumentów: nagłówki, pogrubienie, kursywę, listy, linki (tylko http/https), kod i cytaty.
 * Skrypty, style, obrazy i nieznane znaczniki są pomijane, a ich tekst zostaje.
 */

const SKIP = new Set(["SCRIPT", "STYLE", "IMG", "IFRAME", "OBJECT", "SVG", "HEAD", "TEMPLATE", "NOSCRIPT"]);
const CONTAINER = new Set(["P", "DIV", "SECTION", "ARTICLE", "HEADER", "FOOTER", "TABLE", "TR", "TD", "TH", "TBODY", "THEAD", "CENTER"]);

function safeHref(href: string | null): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Jeden węzeł jako tekst wewnątrz akapitu (pogrubienie, kursywa, linki, kod, łamanie wiersza). */
function inlineNode(node: Node): string {
  if (node.nodeType === 3) return (node as Text).data.replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toUpperCase();
  if (SKIP.has(tag)) return "";
  if (tag === "BR") return "\n";
  const inner = Array.from(el.childNodes).map(inlineNode).join("");
  const text = inner.trim();
  if (!text) return inner;
  if (tag === "STRONG" || tag === "B") return `**${text}**`;
  if (tag === "EM" || tag === "I") return `*${text}*`;
  if (tag === "CODE") return `\`${text}\``;
  if (tag === "A") {
    const href = safeHref(el.getAttribute("href"));
    return href ? `[${text}](${href})` : inner;
  }
  return inner;
}

/** Bloki: akapity, nagłówki, listy, cytaty, bloki kodu. Tekst wewnątrzliniowy zbiera się w jeden akapit. */
function blocks(node: Node, out: string[]): void {
  let buf = "";
  const flush = () => {
    const t = buf.replace(/[ \t]+\n/g, "\n").trim();
    if (t) out.push(t);
    buf = "";
  };
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) { buf += inlineNode(child); continue; }
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (SKIP.has(tag)) continue;
    if (/^H[1-6]$/.test(tag)) {
      flush();
      out.push(`${"#".repeat(Number(tag[1]))} ${Array.from(el.childNodes).map(inlineNode).join("").trim()}`);
    } else if (tag === "PRE") {
      flush();
      out.push("```\n" + (el.textContent ?? "").replace(/\n+$/, "") + "\n```");
    } else if (tag === "UL" || tag === "OL") {
      flush();
      // Pozycje jednej listy to jeden blok, z pojedynczymi podziałami linii.
      const items = Array.from(el.children)
        .filter((c) => c.tagName.toUpperCase() === "LI")
        .map((li, i) => (tag === "OL" ? `${i + 1}. ` : "- ") + Array.from(li.childNodes).map(inlineNode).join("").trim());
      if (items.length) out.push(items.join("\n"));
    } else if (tag === "BLOCKQUOTE") {
      flush();
      const inner: string[] = [];
      blocks(el, inner);
      out.push(inner.join("\n\n").split("\n").map((l) => `> ${l}`).join("\n"));
    } else if (CONTAINER.has(tag)) {
      flush();
      blocks(el, out);
    } else {
      buf += inlineNode(el);
    }
    if (tag === "BR") buf += "\n";
  }
  flush();
}

/** Markdown z kawałka HTML; pusty napis, gdy nie ma tekstu do wklejenia. */
export function htmlToMarkdown(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const out: string[] = [];
  blocks(doc.body, out);
  return out.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}
