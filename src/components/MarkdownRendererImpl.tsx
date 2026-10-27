import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TriangleAlert, ChevronRight, Info, Lightbulb, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fragment, memo, type ReactNode } from "react";
import { WikiLink } from "@/components/WikiLinkPreview";
import { isSafeHref, safeHref } from "@/lib/safeUrl";
import { calloutKind, remarkCallouts, type CalloutKind } from "@/lib/markdownCallouts";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  onWikiClick?: (title: string) => void;
  knownTitles?: Set<string>; // lowercase titles
  embed?: EmbedContext;
}

const CALLOUT_STYLE: Record<CalloutKind, { box: string; icon: typeof Info; label: string }> = {
  info: { box: "border-accent/50 bg-accent/10", icon: Info, label: "Informacja" },
  tip: { box: "border-success/50 bg-success/10", icon: Lightbulb, label: "Wskazówka" },
  warning: { box: "border-warning/60 bg-warning/10", icon: TriangleAlert, label: "Uwaga" },
  danger: { box: "border-destructive/60 bg-destructive/10", icon: ShieldAlert, label: "Ważne" },
  toggle: { box: "border-border/60 bg-muted/30", icon: ChevronRight, label: "Szczegóły" },
};

/** Callout albo blok zwijany z wtyczki `remarkCallouts` (atrybuty `data-*` na `div`). */
function Callout({ kind, collapse, title, children }: { kind: CalloutKind; collapse: string; title: string; children: ReactNode }) {
  const style = CALLOUT_STYLE[kind];
  const Icon = style.icon;
  if (collapse) {
    return (
      // Karta otwiera edytor po kliknięciu — rozwijanie bloku nie może go uruchamiać.
      <details open={collapse === "open"} onClick={(e) => e.stopPropagation()} className={cn("group rounded-field border-l-2 px-3 py-1.5 mb-1 text-sm", style.box)}>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
          <span>{title || style.label}</span>
        </summary>
        <div className="pt-1">{children}</div>
      </details>
    );
  }
  return (
    <div role="note" aria-label={title || style.label} className={cn("flex gap-2 rounded-field border-l-2 px-3 py-2 mb-1 text-sm", style.box)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold text-foreground mb-0.5">{title}</p>}
        {children}
      </div>
    </div>
  );
}

import { splitWikiTarget } from "@/lib/wikiLinks";
import { splitEmbedTarget, type EmbedContext } from "@/lib/embeds";
import { blockIdOfLine, stripBlockId } from "@/lib/blockRefs";
import { WikiEmbed } from "@/components/WikiEmbed";

/** `[[link]]` w tekście; osadzenia `![[…]]` są osobnymi blokami (patrz `MarkdownRendererImpl`). */
const WIKI_RX = /\[\[([^[\]\n]+?)\]\]/g;

function renderWithWiki(text: string, onWikiClick?: (t: string) => void, known?: Set<string>) {
  if (!onWikiClick && !known && !text.includes("[[")) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  WIKI_RX.lastIndex = 0;
  while ((m = WIKI_RX.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const { title, heading, display } = splitWikiTarget(m[1]);
    const exists = known?.has(title.toLowerCase());
    parts.push(<WikiLink key={`w-${idx++}`} title={title} heading={heading} label={display} exists={!!exists} onWikiClick={onWikiClick} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 1 ? <>{parts.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</> : text;
}

/**
 * Znacznik `^id` na końcu akapitu: w czytniku niewidoczny, a jego id trafia do `data-block-id`,
 * żeby `[[notatka#^id]]` mogło przewinąć do akapitu.
 */
function splitParagraphId(children: ReactNode): { children: ReactNode; id: string | null } {
  if (typeof children === "string") {
    const id = blockIdOfLine(children);
    return id ? { children: stripBlockId(children), id } : { children, id: null };
  }
  if (!Array.isArray(children)) return { children, id: null };
  const last = children[children.length - 1];
  const id = typeof last === "string" ? blockIdOfLine(last) : null;
  if (!id || typeof last !== "string") return { children, id: null };
  return { children: [...children.slice(0, -1), stripBlockId(last)], id };
}

/** Zwykły Markdown z linkami wiki; bez osadzeń (te wycina `MarkdownRendererImpl`). */
function MarkdownBlocks({ content, className, onWikiClick, knownTitles }: MarkdownRendererProps) {
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
      remarkPlugins={[remarkGfm, remarkCallouts]}
      // Treść notatki bywa od peera/z importu: tylko http(s), mailto, tel i odnośniki względne.
      urlTransform={(url) => (isSafeHref(url) ? url : "")}
      components={{
        h1: ({ children }) => <h1 className="text-base font-display font-bold text-foreground mb-1 in-[.note-card]:text-sm in-[.note-card]:font-semibold">{renderText(children)}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-display font-bold text-foreground mb-1 in-[.note-card]:font-semibold">{renderText(children)}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-display font-semibold text-foreground mb-0.5">{renderText(children)}</h3>,
        p: ({ children }) => {
          const block = splitParagraphId(children);
          return <p data-block-id={block.id ?? undefined} className="text-sm text-foreground/80 leading-relaxed mb-1 last:mb-0">{renderText(block.children)}</p>;
        },
        strong: ({ children }) => <strong className="font-semibold text-foreground">{renderText(children)}</strong>,
        em: ({ children }) => <em className="italic">{renderText(children)}</em>,
        ul: ({ children, className }) => (
          // Lista zadań GFM (`- [ ] …`) ma własne pola wyboru zamiast kropek.
          <ul className={cn("text-sm text-foreground/80 mb-1 space-y-0.5", className?.includes("contains-task-list") ? "list-none pl-1" : "list-disc pl-4")}>{children}</ul>
        ),
        input: ({ type, checked }) => (
          <input type={type} checked={!!checked} disabled readOnly className="mr-1.5 align-middle accent-primary" />
        ),
        del: ({ children }) => <del className="text-foreground/50">{renderText(children)}</del>,
        table: ({ children }) => <div className="overflow-x-auto mb-1"><table className="text-xs border-collapse">{children}</table></div>,
        th: ({ children, style }) => <th style={style} className="border border-border/60 bg-muted/50 px-2 py-1 text-left font-semibold text-foreground">{renderText(children)}</th>,
        td: ({ children, style }) => <td style={style} className="border border-border/60 px-2 py-1 text-foreground/80">{renderText(children)}</td>,
        div: ({ node: _node, children, ...rest }) => {
          const props = rest as Record<string, unknown>;
          const kind = typeof props["data-callout"] === "string" ? calloutKind(props["data-callout"]) : null;
          if (!kind) return <div>{children}</div>;
          const collapse = typeof props["data-collapse"] === "string" ? props["data-collapse"] : "";
          const title = typeof props["data-title"] === "string" ? props["data-title"] : "";
          return <Callout kind={kind} collapse={collapse} title={title}>{children}</Callout>;
        },
        ol: ({ children }) => <ol className="text-sm text-foreground/80 list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{renderText(children)}</li>,
        code: ({ children, className }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="text-xs bg-muted/60 text-foreground px-1 py-0.5 rounded">{children}</code>;
          }
          return <pre className="text-xs bg-muted/60 text-foreground p-2 rounded-field overflow-x-auto mb-1"><code>{children}</code></pre>;
        },
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 italic text-foreground/60 text-sm mb-1">{children}</blockquote>
        ),
        a: ({ children, href }) => (
          <a href={safeHref(href)} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="text-accent underline underline-offset-2 hover:text-accent/80">{children}</a>
        ),
        // Zdalne obrazy z treści nie są ładowane automatycznie: samo wyświetlenie notatki
        // od peera zdradzałoby adres IP (piksel śledzący). Obrazy notatek to załączniki lokalne.
        img: ({ src, alt }) => {
          const href = safeHref(src);
          const label = `obraz: ${alt || "zdalny obraz"}`;
          return href
            ? <a href={href} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="text-accent underline underline-offset-2 hover:text-accent/80">{label}</a>
            : <span className="text-muted-foreground">{label}</span>;
        },
        hr: () => <hr className="border-border/30 my-2" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

/** Linia, która jest tylko osadzeniem: `![[Tytuł]]` albo `![[Tytuł#Nagłówek]]`. */
const EMBED_LINE_RX = /^[ \t]*!\[\[([^[\]\n]+?)\]\][ \t]*$/;

/**
 * Markdown notatki. Linie będące wyłącznie osadzeniem wycinamy przed parsowaniem i renderujemy
 * `WikiEmbed`; reszta idzie przez zwykły renderer. Osadzenie w środku zdania zostaje tekstem.
 */
export const MarkdownRendererImpl = memo(function MarkdownRendererImpl({ content, className, onWikiClick, knownTitles, embed = { depth: 0, chain: [] } }: MarkdownRendererProps) {
  const lines = content.split("\n");
  if (!lines.some((l) => EMBED_LINE_RX.test(l))) {
    return <MarkdownBlocks content={content} className={className} onWikiClick={onWikiClick} knownTitles={knownTitles} />;
  }
  const blocks: ReactNode[] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length === 0) return;
    const text = chunk.join("\n");
    if (text.trim()) blocks.push(<MarkdownBlocks key={`m-${blocks.length}`} content={text} onWikiClick={onWikiClick} knownTitles={knownTitles} />);
    chunk = [];
  };
  for (const line of lines) {
    const m = EMBED_LINE_RX.exec(line);
    if (!m) {
      chunk.push(line);
      continue;
    }
    flush();
    const { title, heading } = splitEmbedTarget(m[1]);
    blocks.push(<WikiEmbed key={`e-${blocks.length}`} title={title} heading={heading} embed={embed} onWikiClick={onWikiClick} knownTitles={knownTitles} />);
  }
  flush();
  return <div className={cn("prose-note leading-relaxed", className)}>{blocks}</div>;
});
