import { Fragment } from "react";
import { matchParts } from "@/lib/searchHighlight";

/** Tekst z zaznaczonymi trafieniami wyszukiwania; bez fraz zwraca zwykły tekst. */
export function Marked({ text, terms }: { text: string; terms: readonly string[] }) {
  return (
    <>
      {matchParts(text, terms).map((p, i) =>
        p.hit
          ? <mark key={i} className="rounded bg-primary/25 px-0.5 text-foreground">{p.text}</mark>
          : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  );
}
