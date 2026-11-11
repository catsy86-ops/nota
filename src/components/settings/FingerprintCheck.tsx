import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupFingerprint, useFingerprints } from "@/lib/study/fingerprintStore";
import { FINGERPRINT_MIN_HEX } from "@/lib/study/documentFingerprint";

const day = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * B4.4 Sprawdzanie odcisku: kod ze stopki PDF („Odcisk dokumentu: …”) porównywany z dokumentami, które
 * ten telefon wystawił. Zgodny = to ten sam protokół, który wyszedł od Ciebie; brak = dokument zmieniono
 * albo wystawiono go na innym urządzeniu.
 */
export function FingerprintCheck() {
  const list = useFingerprints();
  const [code, setCode] = useState("");
  const result = lookupFingerprint(code, list);

  return (
    <div className="space-y-2">
      <Label htmlFor="fingerprint-check" className="text-xs text-muted-foreground">
        Wpisz kod ze stopki PDF, który ktoś Ci pokazuje. Aplikacja sprawdzi, czy to protokół wystawiony na tym telefonie ({list.length} zapisanych).
      </Label>
      <Input id="fingerprint-check" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false}
        className="font-mono" placeholder="np. 3F2A-91C0-77DD-B1E4-5A60-C2D9" maxLength={40} />
      <p className="min-h-5 text-sm" role="status" aria-live="polite" data-testid="fingerprint-result">
        {result.state === "short" && <span className="text-muted-foreground">Wpisz co najmniej {FINGERPRINT_MIN_HEX} znaków kodu, najlepiej cały.</span>}
        {result.state === "found" && <span>Zgadza się: {result.entry.kind} „{result.entry.site}”, wystawiony {day(result.entry.at)}.</span>}
        {result.state === "missing" && <span>Brak takiego odcisku na tym telefonie. Dokument mógł zostać zmieniony albo wystawiono go na innym urządzeniu.</span>}
      </p>
    </div>
  );
}
