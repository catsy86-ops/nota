import { useMemo } from "react";
import { PropCell } from "@/components/NoteTable";
import { useNotesContextOptional } from "@/hooks/NotesProvider";
import { useSearchVersion } from "@/lib/searchNotes";
import { parseQueryBlock, runQueryBlock } from "@/lib/queryBlock";

/**
 * Osadzony widok w notatce (plan Notatek 6.4): tabela notatek z bloku ` ```zapytanie `. Komórki pól to te same
 * `PropCell` co w tabeli notatek, więc wartość da się zmienić w miejscu. Tytuł otwiera notatkę (jak `[[link]]`).
 * Poza `NotesProvider` (np. w izolowanych testach) blok pokazuje tylko swoje zapytanie.
 */
export function QueryBlock({ source, onWikiClick }: { source: string; onWikiClick?: (title: string) => void }) {
  const ctx = useNotesContextOptional();
  const searchVersion = useSearchVersion();
  const spec = useMemo(() => parseQueryBlock(source), [source]);
  const result = useMemo(
    () => (ctx ? runQueryBlock(spec, ctx.notes, { folders: ctx.folders, propDefs: ctx.propDefs }) : null),
    // `searchVersion`: wynik wyszukiwania tekstu może dojść z Workera po chwili.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec, ctx?.notes, ctx?.folders, ctx?.propDefs, searchVersion],
  );

  if (!ctx || !result) {
    return <pre className="mb-1 rounded-field bg-muted/60 p-2 text-xs"><code>{source}</code></pre>;
  }

  const { rows, total, columns, unknownColumns, unknownSort } = result;
  const warnings = [
    unknownColumns.length ? `Nieznane pola w „kolumny”: ${unknownColumns.join(", ")}.` : "",
    unknownSort ? `Nieznane sortowanie „${unknownSort}”.` : "",
  ].filter(Boolean);

  return (
    <div
      data-query-block
      className="not-prose mb-1 overflow-hidden rounded-card border border-border/60 bg-card/60"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-2.5 py-1 text-2xs text-muted-foreground">
        <span className="truncate" title={source}>Zapytanie: {spec.query || "wszystkie notatki"}</span>
        <span className="shrink-0 tabular-nums">{rows.length < total ? `${rows.length} z ${total}` : total}</span>
      </div>
      {warnings.length > 0 && <p role="status" className="px-2.5 py-1 text-2xs text-warning-ink">{warnings.join(" ")}</p>}
      {rows.length === 0 ? (
        <p className="px-2.5 py-2 ui-hint">Brak notatek pasujących do zapytania.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-2xs text-muted-foreground">
                <th scope="col" className="px-2.5 py-1 font-semibold">Notatka</th>
                {columns.map((d) => <th key={d.id} scope="col" className="px-2.5 py-1 font-semibold">{d.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={n.id} data-query-row={n.id} className="border-b border-border/30 last:border-0">
                  <td className="max-w-56 px-2.5 py-1.5">
                    {onWikiClick && n.title.trim() ? (
                      <button type="button" onClick={() => onWikiClick(n.title)} className="truncate text-left font-medium text-accent underline-offset-2 hover:underline">{n.title}</button>
                    ) : (
                      <span className="truncate font-medium">{n.title.trim() || "Bez tytułu"}</span>
                    )}
                  </td>
                  {columns.map((d) => (
                    <td key={d.id} className="max-w-44 px-2.5 py-1 align-middle">
                      <PropCell def={d} note={n} onUpdate={ctx.updateNote} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
