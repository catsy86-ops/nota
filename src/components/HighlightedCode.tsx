import { useEffect, useState } from "react";
import type { CodeSpan } from "@/lib/codeHighlight";

/**
 * Blok kodu z kolorami składni w czytniku i na kaflu (plan Notatek 5.3). Do czasu pobrania gramatyki (osobny chunk,
 * poza głównym kodem) i dla nieznanego języka pokazuje zwykły tekst w tym samym `<pre>`, więc układ się nie przesuwa.
 */
export function HighlightedCode({ code, language }: { code: string; language: string }) {
  const [spans, setSpans] = useState<CodeSpan[] | null>(null);
  useEffect(() => {
    let alive = true;
    setSpans(null);
    import("@/lib/codeHighlight")
      .then((m) => m.highlightCode(code, language))
      .then((s) => { if (alive) setSpans(s); })
      .catch(() => { /* offline bez chunku języka albo błąd parsera: zostaje zwykły tekst */ });
    return () => { alive = false; };
  }, [code, language]);

  return (
    <pre className="code-hl text-xs bg-muted/60 text-foreground p-2 rounded-field overflow-x-auto mb-1" data-language={language}>
      <code>{spans ? spans.map((s, i) => (s.cls ? <span key={i} className={s.cls}>{s.text}</span> : s.text)) : code}</code>
    </pre>
  );
}
