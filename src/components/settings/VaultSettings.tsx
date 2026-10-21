import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVault } from "@/hooks/usePrivateNotes";
import { privateNotes } from "@/lib/privateNotes";
import { AUTOLOCK_CHOICES, lockEverywhere, setAutoLockMinutes, useAutoLockMinutes } from "@/lib/vaultAutoLock";
import { vaultUi } from "@/lib/vaultUi";
import { Section } from "./SettingsShared";

const CHOICE_LABEL = (m: number) => (m === 0 ? "Nigdy (do zamknięcia karty)" : m === 1 ? "Po 1 minucie" : `Po ${m} minutach`);

const STATUS = {
  none: "Skarbiec nie jest jeszcze ustawiony. Pojawi się przy pierwszym zablokowaniu notatki.",
  locked: "Skarbiec jest zablokowany — prywatne notatki pokazują się jako kłódki.",
  locking: "Blokuję skarbiec…",
  unlocked: "Skarbiec jest odblokowany w tej karcie.",
} as const;

/** Ustawienia prywatnych (zablokowanych) notatek + uczciwy opis tego, co chroni, a czego nie. */
export function VaultSettings() {
  const vault = useVault();
  const minutes = useAutoLockMinutes();
  const has = vault.phase !== "none";

  return (
    <Section title="Prywatne notatki">
      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 space-y-3">
        <p role="status" className="text-xs text-muted-foreground flex items-start gap-2" data-testid="vault-status">
          <ShieldCheck className="w-4 h-4 shrink-0 text-primary-ink" aria-hidden />
          <span>{STATUS[vault.phase]}</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {vault.phase === "none" && (
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
            className="h-9 coarse:h-11 rounded-md border border-input bg-background px-2 text-sm"
          >
            {AUTOLOCK_CHOICES.map((m) => <option key={m} value={m}>{CHOICE_LABEL(m)}</option>)}
          </select>
        </div>
        <p className="text-2xs text-muted-foreground">Dodatkowo skarbiec blokuje się, gdy karta jest ukryta dłużej niż minutę.</p>
      </div>

      <details className="rounded-xl border border-border/60 px-4 py-3 text-xs leading-relaxed text-muted-foreground" data-testid="vault-howto">
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
