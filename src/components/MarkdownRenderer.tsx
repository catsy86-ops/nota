import { lazy, memo, Suspense } from "react";
import { cn } from "@/lib/utils";
import { Bold, Code, Heading2, Italic, Link2, List, Quote } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onWikiClick?: (title: string) => void;
  knownTitles?: Set<string>; // lowercase titles
}

// react-markdown z ekosystemem mdast/micromark/hast to kilkadziesiąt KB — ładujemy je
// dopiero, gdy jakaś notatka faktycznie jest renderowana, nie w głównym pakiecie.
const Impl = lazy(() => import("./MarkdownRendererImpl").then((m) => ({ default: m.MarkdownRendererImpl })));

/**
 * Czy tekst może zawierać składnię Markdown/GFM (nagłówki, listy, linki, `[[wiki]]`, adresy do
 * autolinkowania, tabele, encje…). Ostrożnie: przy wątpliwości idzie pełny renderer.
 */
const MARKDOWN_HINT = /[*_`#>[\]|~<&\\]|https?:|www\.|@|^\s*(?:[-+]|\d+[.)])\s|^\s*[-=]{2,}\s*$/m;

export function needsMarkdown(content: string): boolean {
  return MARKDOWN_HINT.test(content);
}

/**
 * Zwykły tekst bez składni (większość krótkich notatek) — bez react-markdown: 300 kafli to
 * 300 parserów i drzew. Wynik jak u renderera: akapity po pustej linii, pojedynczy enter to spacja.
 */
function PlainParagraphs({ content, className }: { content: string; className?: string }) {
  const paragraphs = content.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  return (
    <div className={cn("prose-note leading-relaxed", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-foreground/80 leading-relaxed mb-1 last:mb-0">{p}</p>
      ))}
    </div>
  );
}

/** Do czasu pobrania renderera pokazuje surowy tekst w tym samym kontenerze — bez skoku układu. */
export const MarkdownRenderer = memo(function MarkdownRenderer(props: MarkdownRendererProps) {
  if (!needsMarkdown(props.content)) return <PlainParagraphs content={props.content} className={props.className} />;
  return (
    <Suspense fallback={<div className={cn("whitespace-pre-wrap wrap-break-word", props.className)}>{props.content}</div>}>
      <Impl {...props} />
    </Suspense>
  );
});

/** `nowrap` — jeden przewijany rząd (wąski kafel), zamiast łamania na dwa. */
export function FormatToolbar({ onInsert, nowrap = false }: { onInsert: (before: string, after: string) => void; nowrap?: boolean }) {
  // Ikony zamiast znaków Markdown („B I H • > </> [[ ]]” w 11 px były nieczytelne).
  const tools = [
    { Icon: Bold, before: "**", after: "**", title: "Pogrubienie" },
    { Icon: Italic, before: "_", after: "_", title: "Kursywa" },
    { Icon: Heading2, before: "## ", after: "", title: "Nagłówek" },
    { Icon: List, before: "- ", after: "", title: "Lista punktowana" },
    { Icon: Quote, before: "> ", after: "", title: "Cytat" },
    { Icon: Code, before: "`", after: "`", title: "Kod" },
    { Icon: Link2, before: "[[", after: "]]", title: "Link do notatki" },
  ];

  return (
    <div role="toolbar" aria-label="Formatowanie" className={cn("flex items-center gap-0.5 -ml-1.5", nowrap ? "flex-nowrap overflow-x-auto min-w-0 scrollbar-none" : "flex-wrap")}>
      {tools.map(({ Icon, ...t }) => (
        <button
          key={t.title}
          type="button"
          onClick={() => onInsert(t.before, t.after)}
          title={t.title}
          aria-label={t.title}
          className="pressable p-1.5 coarse:p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="w-3.5 h-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
