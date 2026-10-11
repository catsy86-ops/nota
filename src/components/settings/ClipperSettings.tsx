import { useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildClipperBookmarklet } from "@/lib/clipperBookmarklet";
import { Section } from "./SettingsShared";

/** Zakładka „Zapisz w NOTKI”: przeciągnij na pasek zakładek, klikaj na dowolnej stronie. */
export function ClipperSettings() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const code = buildClipperBookmarklet(window.location.origin);

  // React nie przepuszcza `javascript:` w `href`, więc adres trafia przez DOM.
  useEffect(() => { linkRef.current?.setAttribute("href", code); }, [code]);

  return (
    <Section title="Web clipper (zakładka w przeglądarce)">
      <p className="text-xs text-muted-foreground">
        Przeciągnij przycisk poniżej na pasek zakładek. Na dowolnej stronie kliknij zakładkę — tytuł, adres
        i zaznaczony fragment trafią do nowej notatki w NOTKI.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          ref={linkRef}
          draggable
          onClick={(e) => { e.preventDefault(); toast("Przeciągnij ten przycisk na pasek zakładek"); }}
          className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium cursor-grab"
        >
          Zapisz w NOTKI
        </a>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(
              () => toast.success("Skopiowano kod zakładki"),
              () => toast.error("Nie udało się skopiować"),
            );
          }}
        >
          <Copy className="w-4 h-4 mr-1.5" />Kopiuj kod
        </Button>
      </div>
    </Section>
  );
}
