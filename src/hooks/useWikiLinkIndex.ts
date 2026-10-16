import { useMemo } from "react";
import type { Note } from "@/hooks/useNotes";
import { useStableByKey } from "@/hooks/useLatestRef";
import { buildWikiIndex, wikiIndexKey } from "@/lib/wikiLinks";

/**
 * Notatki, do których prowadzą [[linki]], i to, co dostaje każda karta: znane tytuły i indeks linków.
 * Notatki prywatne nie tworzą linków, tytułów do podpowiedzi ani backlinków. `knownTitles` i `wikiIndex`
 * zostają tym samym obiektem, dopóki tytuły i linki się nie zmienią (odhaczenie checklisty ich nie rusza).
 */
export function useWikiLinkIndex(notes: Note[], archivedNotes: Note[]) {
  const allNotesForLinks = useMemo(() => [...notes, ...archivedNotes].filter((n) => !n.locked), [notes, archivedNotes]);
  const titlesList = useMemo(
    () => [...new Set(allNotesForLinks.map((n) => n.title.trim().toLowerCase()).filter(Boolean))].sort(),
    [allNotesForLinks],
  );
  const freshKnownTitles = useMemo(() => new Set(titlesList), [titlesList]);
  const knownTitles = useStableByKey(freshKnownTitles, titlesList.join("\n"));
  const freshWikiIndex = useMemo(() => buildWikiIndex(allNotesForLinks), [allNotesForLinks]);
  const wikiIndex = useStableByKey(freshWikiIndex, wikiIndexKey(freshWikiIndex));
  return { allNotesForLinks, knownTitles, wikiIndex };
}
