import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Fragment, memo, type ReactNode } from "react";
import { Bold, Code, Heading2, Italic, Link2, List, Quote } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onWikiClick?: (title: string) => void;
  knownTitles?: Set<string>; // lowercase titles
}

const WIKI_RX = /\[\[([^[\]\n]+?)\]\]/g;

function renderWithWiki(text: string, onWikiClick?: (t: string) => void, known?: Set<string>) {
  if (!onWikiClick && !known) return text;
  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = WIKI_RX.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const title = m[1].trim();
    const exists = known?.has(title.toLowerCase());
    parts.push(
      <button
        key={`w-${idx++}`}
        type="button"
        onClick={(e) => { e.stopPropagation(); onWikiClick?.(title); }}
        className={cn(
          "inline px-1 rounded transition-colors font-medium",
          exists
            ? "text-accent bg-accent/10 hover:bg-accent/20"
            : "text-muted-foreground bg-muted/40 hover:bg-muted/60 italic"
        )}
        title={exists ? `Otwórz „${title}"` : `Notatka „${title}" nie istnieje`}
      >
        {title}
      </button>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 1 ? <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</> : text;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, className, onWikiClick, knownTitles }: MarkdownRendererProps) {
  const renderText = (children: ReactNode) => {
    if (typeof children === "string") return renderWithWiki(children, onWikiClick, knownTitles);
    if (Array.isArray(children)) {
      return children.map((c, i) =>
        typeof c === "string" ? <Fragment key={i}>{renderWithWiki(c, onWikiClick, knownTitles)}</Fragment> : c
      );
    }
    return children;
  };

  return (
    <ReactMarkdown
      className={cn("prose-note leading-relaxed", className)}
      components={{
        h1: ({ children }) => <h1 className="text-base font-display font-bold text-foreground mb-1">{renderText(children)}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-display font-bold text-foreground mb-1">{renderText(children)}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">{renderText(children)}</h3>,
        p: ({ children }) => <p className="text-sm text-foreground/80 leading-relaxed mb-1 last:mb-0">{renderText(children)}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{renderText(children)}</strong>,
        em: ({ children }) => <em className="italic">{renderText(children)}</em>,
        ul: ({ children }) => <ul className="text-sm text-foreground/80 list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="text-sm text-foreground/80 list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{renderText(children)}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="text-xs bg-muted/60 text-foreground px-1 py-0.5 rounded">{children}</code>;
          }
          return <pre className="text-xs bg-muted/60 text-foreground p-2 rounded-lg overflow-x-auto mb-1"><code>{children}</code></pre>;
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 italic text-foreground/60 text-sm mb-1">{children}</blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:text-accent/80">{children}</a>
        ),
        hr: () => <hr className="border-border/30 my-2" />,
      }}
    >
      {content}
    </ReactMarkdown>
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
