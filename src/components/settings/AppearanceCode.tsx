import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { decodeAppearance, encodeAppearance } from "@/lib/appearanceCode";

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

/**
 * Kod wyglądu (plan motywów 3.5): skopiuj na jednym urządzeniu, wklej na drugim. Wczytanie zapisuje
 * ustawienia i odświeża aplikację — moduły wyglądu czytają je przy starcie i same sprawdzają wartości.
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
  const load = () => {
    const values = decodeAppearance(code);
    if (!values) {
      toast.error("To nie jest kod wyglądu. Kod zaczyna się od „NOTKI1-”.");
      return;
    }
    try {
      for (const [k, v] of Object.entries(values)) localStorage.setItem(k, v);
    } catch {
      toast.error("Nie udało się zapisać wyglądu w tej przeglądarce.");
      return;
    }
    toast.success("Wczytano wygląd — odświeżam");
    window.setTimeout(() => window.location.reload(), 600);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground -mt-1">Styl, jasność, akcent, kształt, tło, krój i rozmiar tekstu jako jeden kod — do przeniesienia na inne urządzenie.</p>
      <Button type="button" variant="outline" size="sm" className="coarse:h-11" onClick={copy}>Kopiuj kod wyglądu</Button>
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
