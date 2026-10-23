import { lazy, Suspense } from "react";
import { lookupWikiTarget } from "@/lib/wikiNoteActions";
import { extractSection, isBlockEmbed, MAX_EMBED_DEPTH } from "@/lib/embeds";
import type { EmbedContext } from "@/lib/embeds";

// Renderer Markdown jest leniwy (MarkdownRenderer), a osadzenie wraca do niego rekurencyjnie.
const MarkdownRenderer = lazy(() => import("./MarkdownRenderer").then((m) => ({ default: m.MarkdownRenderer })));

interface WikiEmbedProps {
  title: string;
  heading: string | null;
  embed: EmbedContext;
  onWikiClick?: (title: string) => void;
  knownTitles?: Set<string>;
}

function Notice({ text }: { text: string }) {
  return <p data-embed-notice="" className="my-1 rounded border border-dashed border-border/70 px-2 py-1 text-xs text-muted-foreground">{text}</p>;
}

/**
 * `![[notatka]]` i `![[notatka#nagłówek]]`: treść notatki w miejscu linku, tylko do odczytu.
 * Zagnieżdżenie idzie przez ten sam renderer z większą głębokością i listą odwiedzonych
 * notatek — cykl (A osadza B, B osadza A) i zbyt głębokie zagnieżdżenie kończą się notatką, nie pętlą.
 */
export function WikiEmbed({ title, heading, embed, onWikiClick, knownTitles }: WikiEmbedProps) {
  if (isBlockEmbed(heading)) return <Notice text="Osadzanie bloku ^… jest w przygotowaniu." />;
  const note = lookupWikiTarget(title);
  if (!note) return <Notice text={`Nie ma notatki „${title}”.`} />;
  if (note.locked) return <Notice text="Notatka prywatna — nie osadzam jej tutaj." />;
  if (embed.chain.includes(note.id)) return <Notice text={`Cykl: „${note.title}” jest już otwarta wyżej.`} />;
  if (embed.depth >= MAX_EMBED_DEPTH) return <Notice text={`Zbyt głębokie osadzenie (limit ${MAX_EMBED_DEPTH}).`} />;
  const body = heading ? extractSection(note.content, heading) : note.content;
  if (body === null) return <Notice text={`Nie ma nagłówka „${heading}” w „${note.title}”.`} />;
  return (
    <figure data-embed="" className="my-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <figcaption className="mb-1 text-xs font-semibold text-muted-foreground">
        {heading ? `${note.title} › ${heading}` : note.title}
      </figcaption>
      <Suspense fallback={<p className="text-xs text-muted-foreground">Wczytywanie…</p>}>
        <MarkdownRenderer
          content={body}
          onWikiClick={onWikiClick}
          knownTitles={knownTitles}
          embed={{ depth: embed.depth + 1, chain: [...embed.chain, note.id] }}
        />
      </Suspense>
    </figure>
  );
}
