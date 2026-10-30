import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { applyAppearanceValues, appearanceLink, decodeAppearance, encodeAppearance, snapshotAppearance } from "@/lib/appearanceCode";
import { shareOrCopy } from "@/lib/shareOrCopy";
import { toastWithUndo } from "@/lib/undoToast";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/**
 * Kod wyglądu (plan motywów 3.5, 1.5): skopiuj na jednym urządzeniu, wklej na drugim, albo wyślij link
 * `#wyglad=NOTKI1-…`. Wczytanie stosuje wygląd od razu (bez przeładowania) i daje „Cofnij”.
 */
export function AppearanceCode() {
  const [code, setCode] = useState("");
  const copy = async () => {
    const value = encodeAppearance(read);
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Skopiowano kod wyglądu");
    } catch {
      // Bez dostępu do schowka: kod w polu do ręcznego skopiowania.
      setCode(value);
      toast("Skopiuj kod z pola poniżej");
    }
  };
  const share = async () => {
    const value = encodeAppearance(read);
    const outcome = await shareOrCopy({ title: "Wygląd NOTKI", text: appearanceLink(value, window.location.origin) });
    if (outcome === "copied") toast.success("Skopiowano link do wyglądu");
    else if (outcome === "failed") toast.error("Nie udało się udostępnić ani skopiować");
  };
  const load = () => {
    const values = decodeAppearance(code);
    if (!values) {
      toast.error("To nie jest kod wyglądu. Kod zaczyna się od „NOTKI1-”.");
      return;
    }
    const before = snapshotAppearance();
    try {
      applyAppearanceValues(values, { replace: false });
    } catch {
      toast.error("Nie udało się zapisać wyglądu w tej przeglądarce.");
      return;
    }
    setCode("");
    toastWithUndo("Wczytano wygląd", () => applyAppearanceValues(before, { replace: true }));
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground -mt-1">Styl, jasność, akcent, kształt, ramki, poświata, tło, krój, rozmiar tekstu, tryb budowa, ruch i pora roku jako jeden kod — do przeniesienia na inne urządzenie.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={copy}>Kopiuj kod wyglądu</Button>
        <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={share}>Udostępnij link</Button>
      </div>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="appearance-code">Kod wyglądu</label>
        <input
          id="appearance-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="NOTKI1-…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          onKeyDown={(e) => { if (e.key === "Enter") load(); }}
          className="h-9 coarse:h-11 min-w-0 flex-1 rounded-control border border-input bg-background px-2 font-mono text-xs text-foreground"
        />
        <Button type="button" size="sm" className="coarse:h-11" onClick={load} disabled={!code.trim()}>Wczytaj</Button>
      </div>
    </div>
  );
}
