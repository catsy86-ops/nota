import { useEffect, useState } from "react";
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
  return (
    <div
      data-mermaid="ready"
      role="img"
      aria-label="Diagram"
      className="mb-1 overflow-x-auto rounded-field bg-muted/30 p-2 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // SVG z Mermaida przechodzi przez jego czyszczenie (`securityLevel: "strict"`, DOMPurify).
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  );
}
