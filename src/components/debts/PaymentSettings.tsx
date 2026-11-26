import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACCOUNT_INPUT_MAX, cleanAccount, cleanBlik, formatAccount, formatBlik } from "@/lib/paymentDetails";
import { setDebtPayment, useDebtPayment } from "@/lib/debts/payment";
import { useBankAccount } from "@/lib/study/companyPrefs";

/**
 * L2.3 Dane do przelewu w Długach: konto i telefon do BLIK-a, dopisywane do „Wyślij” i „Przypomnij”, gdy ktoś jest nam
 * winien. Zapis przy wyjściu z pola; zły numer nie jest zapisywany, a konto ze złą sumą kontrolną zostaje, ale nie trafia
 * do wiadomości. Tylko na tym urządzeniu.
 */
export function PaymentSettings() {
  const uid = useId();
  const saved = useDebtPayment();
  const workAccount = useBankAccount();
  const [account, setAccount] = useState(saved.account ? formatAccount(saved.account) : "");
  const [blik, setBlik] = useState(saved.blik ? formatBlik(saved.blik) : "");
  const acc = cleanAccount(account);
  const blikValue = cleanBlik(blik);
  const blikBad = blik.trim() !== "" && blikValue === null;
  const work = cleanAccount(workAccount);

  const saveAccount = (text: string) => {
    const a = cleanAccount(text);
    if (a.status === "invalid") return;
    if ((a.value || undefined) === saved.account) return;
    setDebtPayment({ ...saved, account: a.value || undefined });
    if (a.value) setAccount(formatAccount(a.value));
  };
  const saveBlik = () => {
    if (blikBad) return;
    if ((blikValue ?? undefined) === saved.blik) return;
    setDebtPayment({ ...saved, blik: blikValue ?? undefined });
    if (blikValue) setBlik(formatBlik(blikValue));
  };

  return (
    <details className="mt-6 rounded-card border border-border/60 px-3 py-2 text-sm" data-testid="debt-payment-settings">
      <summary className="cursor-pointer py-1 font-medium">Dane do przelewu</summary>
      <p className="ui-hint mt-1">Dopisywane do „Wyślij” i „Przypomnij”, gdy ktoś jest Ci winien. Zostają na tym urządzeniu — bez kopii i synchronizacji.</p>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <label htmlFor={`${uid}-acc`} className="text-xs text-muted-foreground">Numer konta</label>
          <Input id={`${uid}-acc`} value={account} maxLength={ACCOUNT_INPUT_MAX} inputMode="text" autoComplete="off" spellCheck={false} className="font-mono"
            placeholder="np. 61 1090 1014 0000 0712 1981 2874" aria-invalid={acc.status === "invalid"}
            aria-describedby={acc.status === "invalid" || acc.status === "badChecksum" ? `${uid}-acc-msg` : undefined}
            onChange={(e) => setAccount(e.target.value)} onBlur={(e) => saveAccount(e.target.value)} />
          {acc.status === "invalid" && <p id={`${uid}-acc-msg`} role="alert" className="text-xs text-destructive-ink">To nie wygląda na numer konta: 26 cyfr albo IBAN z kodem kraju. Nie zapisano.</p>}
          {acc.status === "badChecksum" && <p id={`${uid}-acc-msg`} role="status" className="text-xs text-destructive-ink">Suma kontrolna się nie zgadza — sprawdź cyfry. Do czasu poprawki numer nie trafi do wiadomości.</p>}
          {work.status === "ok" && work.value !== saved.account && (
            <Button type="button" variant="ghost" size="sm" className="tap-target" onClick={() => { setDebtPayment({ ...saved, account: work.value }); setAccount(formatAccount(work.value)); toast.success("Wpisano konto z Pracy"); }}>
              Użyj konta z Pracy
            </Button>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor={`${uid}-blik`} className="text-xs text-muted-foreground">Telefon do BLIK-a</label>
          <Input id={`${uid}-blik`} value={blik} maxLength={20} inputMode="tel" autoComplete="off" className="w-48 font-mono" placeholder="np. 600 123 456"
            aria-invalid={blikBad} aria-describedby={blikBad ? `${uid}-blik-msg` : undefined}
            onChange={(e) => setBlik(e.target.value)} onBlur={saveBlik} />
          {blikBad && <p id={`${uid}-blik-msg`} role="alert" className="text-xs text-destructive-ink">Wpisz 9 cyfr numeru telefonu (może być z +48). Nie zapisano.</p>}
        </div>
      </div>
    </details>
  );
}
