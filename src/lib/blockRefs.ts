/**
 * Bloki `^id` (Faza 3.4): znacznik na końcu linii, np. `Tekst akapitu ^pomysl`. Blok to grupa
 * linii między pustymi liniami, a przy listach i nagłówkach — jedna pozycja (punkt, nagłówek),
 * żeby `![[notatka#^id]]` nie wciągało całej listy. Znacznik nie jest widoczny w czytniku,
 * ale zostaje w treści (Yjs), więc działa na każdym urządzeniu.
 */

/** Id bloku: litery (też polskie), cyfry i myślniki, do 32 znaków. */
const ID_PATTERN = "[\\p{L}\\p{N}-]{1,32}";
/** Znacznik na końcu linii: spacja (albo początek linii) przed `^id`. */
const TAIL_RX = new RegExp(`(?:^|\\s)\\^(${ID_PATTERN})[ \\t]*$`, "u");
/** Linia zaczynająca nowy blok: pusta, punkt listy albo nagłówek. */
const BREAK_RX = /^\s*$|^\s*(?:[-*+]|\d+[.)])\s|^\s*#{1,6}\s/;
/** Nagłówek jest blokiem jednolinijkowym: tekst pod nim zaczyna już nowy blok. */
const HEADING_RX = /^\s*#{1,6}\s/;

/** Id z końca linii (`Tekst ^id` → `id`), albo `null`. */
export function blockIdOfLine(line: string): string | null {
  const m = TAIL_RX.exec(line);
  return m ? m[1] : null;
}

/** Linia bez znacznika `^id` na końcu (sam tekst bloku). */
export function stripBlockId(line: string): string {
  return line.replace(new RegExp(`(?:^|\\s)\\^${ID_PATTERN}[ \\t]*$`, "u"), "").replace(/\s+$/, "");
}

/** Id z nagłówka osadzenia / linku: `^id` → `id`; `null` dla zwykłego nagłówka. */
export function blockIdOfHeading(heading: string | null): string | null {
  if (heading === null || !heading.startsWith("^")) return null;
  const id = heading.slice(1).trim();
  return id ? id : null;
}

interface Block {
  lines: string[];
  id: string | null;
}

/** Podział treści na bloki; znacznik `^id` może stać w dowolnej linii bloku. */
function splitBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length === 0) return;
    const id = current.map(blockIdOfLine).find((x): x is string => x !== null) ?? null;
    blocks.push({ lines: current, id });
    current = [];
  };
  for (const line of content.split("\n")) {
    if (BREAK_RX.test(line)) {
      flush();
      if (line.trim() === "") continue;
    }
    current.push(line);
    if (HEADING_RX.test(line)) flush();
  }
  flush();
  return blocks;
}

/** Tekst bloku o podanym id (bez znacznika), bez względu na wielkość liter; brak → `null`. */
export function findBlock(content: string, id: string): string | null {
  const wanted = id.trim().toLowerCase();
  if (!wanted) return null;
  const block = splitBlocks(content).find((b) => b.id?.toLowerCase() === wanted);
  return block ? block.lines.map(stripBlockId).join("\n") : null;
}

/** Wszystkie id bloków notatki w kolejności występowania, bez duplikatów. */
export function listBlockIds(content: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of splitBlocks(content)) {
    if (!b.id || seen.has(b.id.toLowerCase())) continue;
    seen.add(b.id.toLowerCase());
    out.push(b.id);
  }
  return out;
}

/**
 * Podpowiedzi dla `[[Tytuł#^pre`: zapytanie rozbite na tytuł i początek id.
 * `null`, gdy zapytanie nie dotyczy bloku.
 */
export function blockRefQuery(query: string): { title: string; prefix: string } | null {
  const i = query.indexOf("#^");
  if (i < 0) return null;
  return { title: query.slice(0, i).trim(), prefix: query.slice(i + 2).toLowerCase() };
}
