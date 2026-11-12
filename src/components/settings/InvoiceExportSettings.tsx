import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadBlob } from "@/lib/downloadBlob";
import { MIN_PASSWORD_LENGTH, passwordStrength } from "@/lib/vault";

/**
 * Zaszyfrowany eksport i import faktur (KSeF, ADR-6). Kopia pełna jest jawnym JSON-em, a faktury niosą dane nabywców,
 * więc ten plik jest chroniony hasłem (PBKDF2 + AES-GCM). Moduł szyfrowania ładujemy dopiero przy użyciu.
 */
export function InvoiceExportSettings() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const strength = passwordStrength(password);

  async function exportFile() {
    setBusy(true);
    try {
      const { exportInvoicesEncrypted, invoiceExportName } = await import("@/lib/ksef/invoiceExport");
      downloadBlob(await exportInvoicesEncrypted(password), invoiceExportName());
      toast.success("Zapisano zaszyfrowany plik z fakturami");
    } catch {
      toast.error("Nie udało się zaszyfrować faktur");
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    try {
      const { importInvoicesEncrypted } = await import("@/lib/ksef/invoiceExport");
      const fresh = await importInvoicesEncrypted(await file.text(), password);
      toast.success(fresh === 0 ? "Wszystkie faktury z pliku już tu są" : `Dodano faktur: ${fresh}`);
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === "decrypt-failed" ? "Złe hasło albo uszkodzony plik" : "To nie jest plik z fakturami Notatnika");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2" data-testid="invoice-export">
      <Label htmlFor="invoice-export-pw" className="text-xs text-muted-foreground">
        Faktury w kopii zapasowej są jawne. Tu możesz zapisać je w pliku chronionym hasłem (min. {MIN_PASSWORD_LENGTH} znaków) albo wczytać taki plik na innym telefonie. Hasła nie da się odzyskać.
      </Label>
      <Input id="invoice-export-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Hasło do pliku" />
      {password && <p className="ui-hint" role="status">{strength.label}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || !strength.ok} onClick={() => void exportFile()} data-testid="invoice-export-save">Zapisz zaszyfrowane faktury</Button>
        <Button type="button" variant="outline" disabled={busy || !password} onClick={() => fileRef.current?.click()} data-testid="invoice-export-load">Wczytaj plik z fakturami</Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="Plik z zaszyfrowanymi fakturami"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
      </div>
    </div>
  );
}
