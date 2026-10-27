import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { privateNotes } from "@/lib/privateNotes";
import { passkeyApiAvailable, platformAuthenticatorAvailable, PasskeyError } from "@/lib/passkey";
import { VaultError } from "@/lib/vault";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useVault } from "@/hooks/usePrivateNotes";
import { AUTOLOCK_CHOICES, HIDDEN_LOCK_CHOICES, lockEverywhere, setAutoLockMinutes, setHiddenLockMinutes, useAutoLockMinutes, useHiddenLockMinutes } from "@/lib/vaultAutoLock";
import { vaultUi } from "@/lib/vaultUi";
import { Section } from "./SettingsShared";

const HIDDEN_LABEL = (m: number) => (m === 0 ? "Nie blokuj" : m === 1 ? "Po 1 minucie" : `Po ${m} minutach`);
const CHOICE_LABEL = (m: number) => (m === 0 ? "Nigdy (do zamknięcia karty)" : m === 1 ? "Po 1 minucie" : `Po ${m} minutach`);

const STATUS = {
  none: "Skarbiec nie jest jeszcze ustawiony. Pojawi się przy pierwszym zablokowaniu notatki.",
  corrupt: "Metadane skarbca w dokumencie są uszkodzone. Nie założę nowego skarbca, żeby nie nadpisać starego i nie stracić notatek prywatnych. Przywróć pełny backup albo zsynchronizuj urządzenie, na którym skarbiec działa.",
  locked: "Skarbiec jest zablokowany — prywatne notatki pokazują się jako kłódki.",
  locking: "Blokuję skarbiec…",
  unlocked: "Skarbiec jest odblokowany w tej karcie.",
} as const;

/** Ustawienia prywatnych (zablokowanych) notatek + uczciwy opis tego, co chroni, a czego nie. */
export function VaultSettings() {
  const vault = useVault();
  const minutes = useAutoLockMinutes();
  const hiddenMinutes = useHiddenLockMinutes();
  const has = vault.phase !== "none";

  return (
    <Section title="Prywatne notatki">
      <div className="rounded-card border border-border/60 bg-muted/30 px-4 py-3 space-y-3">
        <p role="status" className="text-xs text-muted-foreground flex items-start gap-2" data-testid="vault-status">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary-ink" aria-hidden />
          <span>{vault.corrupt ? STATUS.corrupt : STATUS[vault.phase]}</span>
        </p>

        {has && <PasskeyEnroll />}
        <div className="flex flex-wrap gap-2">
          {vault.phase === "none" && !vault.corrupt && (
            <Button type="button" size="sm" variant="outline" onClick={() => vaultUi.open("setup")}>
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />Ustaw hasło skarbca
            </Button>
          )}
          {vault.phase === "locked" && (
            <Button type="button" size="sm" variant="outline" onClick={() => vaultUi.open("unlock")}>
              <KeyRound className="w-3.5 h-3.5 mr-1.5" />Odblokuj
            </Button>
          )}
          {vault.phase === "unlocked" && (
            <Button type="button" size="sm" variant="outline" onClick={() => void lockEverywhere(privateNotes)}>
              <Lock className="w-3.5 h-3.5 mr-1.5" />Zablokuj teraz
            </Button>
          )}
          {has && (
            <Button type="button" size="sm" variant="ghost" onClick={() => vaultUi.open("change")}>Zmień hasło</Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="vault-autolock" className="text-sm font-semibold">Blokuj automatycznie</label>
          <select
            id="vault-autolock"
            value={minutes}
            onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
            className="h-9 coarse:h-11 rounded-control border border-input bg-background px-2 text-sm"
          >
            {AUTOLOCK_CHOICES.map((m) => <option key={m} value={m}>{CHOICE_LABEL(m)}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="vault-hidden-lock" className="text-sm font-semibold">Blokuj po schowaniu karty</label>
          <select
            id="vault-hidden-lock"
            value={hiddenMinutes}
            onChange={(e) => setHiddenLockMinutes(Number(e.target.value))}
            className="h-9 coarse:h-11 rounded-control border border-input bg-background px-2 text-sm"
          >
            {HIDDEN_LOCK_CHOICES.map((m) => <option key={m} value={m}>{HIDDEN_LABEL(m)}</option>)}
          </select>
        </div>
        <p className="text-2xs text-muted-foreground">Skarbiec blokuje się też, gdy karta jest ukryta dłużej niż wybrany czas.</p>
      </div>

      <details className="rounded-card border border-border/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground" data-testid="vault-howto">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Jak to działa i czego nie robi</summary>
        <div className="mt-2 space-y-2">
          <p>
            <strong className="text-foreground">Co robi.</strong> Tytuł, tekst, lista zadań i etykiety zablokowanej notatki są szyfrowane
            w tej przeglądarce (AES-256-GCM, klucz z hasła przez PBKDF2, 600 000 iteracji). Klucz żyje tylko w pamięci karty i znika po
            zablokowaniu. W bazie, w kopiach zapasowych i w synchronizacji są wyłącznie szyfrogramy. Zablokowane notatki nie biorą udziału
            w wyszukiwaniu, grafie powiązań, przeglądzie tygodnia, eksporcie do Markdown/HTML ani w palecie poleceń — także po odblokowaniu.
          </p>
          <p>
            <strong className="text-foreground">Czego nie robi.</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nie chroni przed osobą, która ma dostęp do odblokowanej sesji (otwarta karta, odblokowany komputer).</li>
            <li>Nie chroni przed złośliwym rozszerzeniem, keyloggerem, luką XSS ani zrzutem pamięci — hasło i treść są wtedy jawne w pamięci.</li>
            <li>Zostają jawne: kolor, przypięcie, folder, daty utworzenia i zmiany, termin przypomnienia (bez tekstu), sam fakt istnienia notatki i jej przybliżony rozmiar.</li>
            <li>Słabe hasło da się złamać offline, jeśli ktoś zdobędzie kopię zapasową albo dokument synchronizacji (sól i opakowany klucz są w nich zapisane).</li>
            <li>Zapomnianego hasła nie da się odzyskać; pomaga tylko kod awaryjny, jeśli go zapisano.</li>
            <li>Nie usuwa wcześniejszych jawnych kopii: starsze backupy, inne urządzenia i pliki synchronizacji sprzed zablokowania mogą zawierać tekst.</li>
            <li>Notatka z obrazami lub załącznikami nie może być zablokowana — pliki nie są szyfrowane.</li>
            <li>Zablokowana notatka to jeden blok bez współdzielonej edycji: przy zmianach na dwóch urządzeniach naraz wygra ostatni zapis.</li>
            <li>Limit prób hasła działa tylko po stronie tej przeglądarki i nie zatrzyma kogoś, kto ma kopię danych.</li>
          </ul>
        </div>
      </details>
    </Section>
  );
}

/** Dodanie odblokowania biometrią (V-4): hasło potwierdza, a passkey zapisuje się w skarbcu. Tylko przy wsparciu PRF. */
function PasskeyEnroll() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => { void platformAuthenticatorAvailable().then(setAvailable); }, []);
  if (!passkeyApiAvailable() || !available) return null;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    try {
      await privateNotes.addPasskey(password, "NOTKI");
      setPassword("");
      toast.success("Dodano odblokowanie biometrią");
    } catch (err) {
      const code = err instanceof PasskeyError ? err.code : err instanceof VaultError ? err.code : null;
      toast.error(
        code === "bad-password" ? "Nieprawidłowe hasło skarbca"
          : code === "prf-unsupported" ? "Ta przeglądarka lub telefon nie obsługuje odblokowania biometrią (PRF)"
          : code === "cancelled" ? "Anulowano"
          : "Nie udało się dodać odblokowania biometrią",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={add} className="space-y-2" aria-label="Odblokowanie biometrią">
      <p className="text-xs text-muted-foreground">Odblokuj skarbiec odciskiem palca albo twarzą zamiast hasła. Hasło dalej działa.</p>
      <div className="flex gap-2">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Hasło skarbca" aria-label="Hasło skarbca do dodania odblokowania" autoComplete="current-password" className="coarse:h-11" />
        <Button type="submit" size="sm" variant="outline" disabled={busy || !password} className="coarse:h-11">Dodaj biometrię</Button>
      </div>
    </form>
  );
}
