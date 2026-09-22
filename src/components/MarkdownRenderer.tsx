import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Fragment } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onWikiClick?: (title: string) => void;
  knownTitles?: Set<string>; // lowercase titles
}

const WIKI_RX = /\[\[([^\[\]\n]+?)\]\]/g;

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
            ? "text-primary bg-primary/10 hover:bg-primary/20"
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

export function MarkdownRenderer({ content, className, onWikiClick, knownTitles }: MarkdownRendererProps) {
  const renderText = (children: any) => {
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
      className={cn("prose-note", className)}
      components={{
        h1: ({ children }) => <h1 className="text-base font-display font-bold text-foreground mb-1">{renderText(children)}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-display font-bold text-foreground mb-1">{renderText(children)}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">{renderText(children)}</h3>,
        p: ({ children }) => <p className="text-sm text-foreground/70 leading-relaxed mb-1 last:mb-0">{renderText(children)}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{renderText(children)}</strong>,
        em: ({ children }) => <em className="italic">{renderText(children)}</em>,
        ul: ({ children }) => <ul className="text-sm text-foreground/70 list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="text-sm text-foreground/70 list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
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
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">{children}</a>
        ),
        hr: () => <hr className="border-border/30 my-2" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export function FormatToolbar({ onInsert }: { onInsert: (before: string, after: string) => void }) {
  const tools = [
    { label: "B", before: "**", after: "**", title: "Pogrubienie" },
    { label: "I", before: "_", after: "_", title: "Kursywa" },
    { label: "H", before: "## ", after: "", title: "Nagłówek" },
    { label: "•", before: "- ", after: "", title: "Lista" },
    { label: ">", before: "> ", after: "", title: "Cytat" },
    { label: "</>", before: "`", after: "`", title: "Kod" },
    { label: "[[ ]]", before: "[[", after: "]]", title: "Link do notatki" },
  ];

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {tools.map((t) => (
        <button
          key={t.label}
          onClick={() => onInsert(t.before, t.after)}
          title={t.title}
          className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded transition-colors"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
