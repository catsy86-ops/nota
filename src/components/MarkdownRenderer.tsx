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

/** Do czasu pobrania renderera pokazuje surowy tekst w tym samym kontenerze — bez skoku układu. */
export const MarkdownRenderer = memo(function MarkdownRenderer(props: MarkdownRendererProps) {
  return (
    <Suspense fallback={<div className={cn("whitespace-pre-wrap break-words", props.className)}>{props.content}</div>}>
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
          className="pressable p-1.5 coarse:p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="w-3.5 h-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
