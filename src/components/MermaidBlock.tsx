import { useEffect, useMemo, useState } from "react";
import { StatusPanel } from "@/components/StatusPanel";
import type { MermaidResult } from "@/lib/mermaidRender";

/** Zmiana motywu (jasny/ciemny, styl) przemalowuje diagram. Reaguje tylko na zmianę „ciemny + styl”, nie na inne klasy `<html>`. */
function useThemeVersion(): string {
  const read = () => `${document.documentElement.classList.contains("dark") ? "dark" : "light"}|${document.documentElement.dataset.skin ?? ""}`;
  const [sig, setSig] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setSig(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-skin"] });
    return () => obs.disconnect();
  }, []);
  return sig;
}

/**
 * Diagram z bloku ` ```mermaid ` (plan Notatek 5.5). Do czasu pobrania biblioteki (osobny chunk) pokazuje źródło;
 * błąd składni to inline `StatusPanel` z pierwszą linią komunikatu i źródłem pod spodem.
 */
export function MermaidBlock({ source }: { source: string }) {
  const [result, setResult] = useState<MermaidResult | null>(null);
  const theme = useThemeVersion();
  useEffect(() => {
    let alive = true;
    import("@/lib/mermaidRender")
      .then((m) => m.renderMermaid(source))
      .then((r) => { if (alive) setResult(r); })
      .catch(() => { if (alive) setResult({ ok: false, error: "Nie udało się wczytać modułu diagramów (offline?)." }); });
    return () => { alive = false; };
  }, [source, theme]);

  if (!result) {
    return <pre data-mermaid="loading" className="mb-1 overflow-x-auto rounded-field bg-muted/60 p-2 text-xs"><code>{source}</code></pre>;
  }
  if (!result.ok) {
    return (
      <div data-mermaid="error" className="mb-1 space-y-1">
        <StatusPanel tone="error" size="inline" title="Nie udało się narysować diagramu" description={result.error} />
        <pre className="overflow-x-auto rounded-field bg-muted/60 p-2 text-xs"><code>{source}</code></pre>
      </div>
    );
  }
  return <MermaidImage svg={result.svg} />;
}

/**
 * Druga warstwa obrony (S1.6): SVG trafia do `<img src="blob:…">`, nie do DOM strony. Skrypty i obsługa zdarzeń w SVG
 * wczytanym jako obraz się nie wykonują, więc błąd w czyszczeniu Mermaida nie kończy się XSS. Koszt: diagramu nie da się
 * zaznaczyć, a czcionki strony nie sięgają obrazu (stąd jawna czcionka systemowa w `mermaidRender`).
 */
function MermaidImage({ svg }: { svg: string }) {
  const url = useMemo(() => {
    // Mermaid zawsze dodaje `xmlns`, którego `<img>` wymaga.
    return URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }, [svg]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  // Szerokość naturalna z `max-width` w stylu SVG Mermaida; obraz bez niej rozciągnąłby mały diagram na całą kartę.
  const maxWidth = Number(/max-width:\s*([\d.]+)px/.exec(svg)?.[1]);
  return (
    <div data-mermaid="ready" className="mb-1 overflow-x-auto rounded-field bg-muted/30 p-2">
      <img src={url} alt="Diagram" style={maxWidth > 0 ? { maxWidth } : undefined} className="mx-auto h-auto w-full" />
    </div>
  );
}
