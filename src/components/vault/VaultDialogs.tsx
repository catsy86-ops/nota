import { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TriangleAlert, Copy, Download, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { privateNotes, VaultThrottledError } from "@/lib/privateNotes";
import { MIN_PASSWORD_LENGTH, VaultError, passwordStrength } from "@/lib/vault";
import { passkeyApiAvailable } from "@/lib/passkey";
import { vaultUi, type VaultUiKind } from "@/lib/vaultUi";
import { downloadBlob } from "@/lib/downloadBlob";

/** Okna skarbca (ładowane na żądanie przez `VaultHost`). */
export function VaultDialog({ kind, onDone }: { kind: VaultUiKind; onDone?: () => void }) {
  const [mode, setMode] = useState<VaultUiKind>(kind);
  // Po założeniu / zmianie hasła pokazujemy kod awaryjny (raz) zamiast zamykać okno.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  function finish() {
    const done = onDone;
    vaultUi.close();
    done?.();
  }

  const title = recoveryCode ? "Zapisz kod awaryjny"
    : mode === "setup" ? "Ustaw hasło skarbca"
    : mode === "change" ? "Zmień hasło skarbca"
    : mode === "recover" ? "Odzyskaj dostęp kodem awaryjnym"
    : "Odblokuj prywatne notatki";

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !recoveryCode) vaultUi.close(); }}>
      <ResponsiveDialogContent
        className="sm:max-w-md"
        // Kod awaryjny widać raz — nie wolno go zamknąć przypadkiem.
        onInteractOutside={(e) => { if (recoveryCode) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (recoveryCode) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            {recoveryCode ? <ShieldCheck className="w-4 h-4 text-primary-ink" /> : <Lock className="w-4 h-4 text-primary-ink" />}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">Okno skarbca prywatnych notatek</DialogDescription>
        </DialogHeader>
        {recoveryCode ? (
          <RecoveryCodeStep code={recoveryCode} onClose={finish} />
        ) : mode === "setup" ? (
          <SetupForm onCreated={(code) => (code ? setRecoveryCode(code) : finish())} />
        ) : mode === "change" ? (
          <ChangeForm onChanged={(code) => (code ? setRecoveryCode(code) : finish())} />
        ) : mode === "recover" ? (
          <RecoverForm onBack={() => setMode("unlock")} onDone={(code) => (code ? setRecoveryCode(code) : finish())} />
        ) : (
          <UnlockForm onUnlocked={finish} onRecover={() => setMode("recover")} />
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}

// ── pola wspólne ──────────────────────────────────────────────────────────────

function StrengthMeter({ password }: { password: string }) {
  const s = passwordStrength(password);
  const tone = s.score >= 3 ? "bg-primary" : s.score === 2 ? "bg-warning" : "bg-destructive";
  return (
    <div data-testid="password-strength">
      {/* Czytnik słyszy tylko zmianę poziomu siły, nie każdy znak. */}
      <span role="status" className="sr-only">{password ? s.label : ""}</span>
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", s.score >= i ? tone : "bg-muted")} />
        ))}
      </div>
      <p className="mt-1 text-2xs text-muted-foreground">
        {password ? `${s.label} · ${[...password].length} znaków` : `Co najmniej ${MIN_PASSWORD_LENGTH} znaków; im dłuższe, tym lepiej (np. kilka słów).`}
      </p>
    </div>
  );
}

function NoRecoveryWarning() {
  return (
    <div role="note" className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs leading-relaxed">
      <TriangleAlert className="w-4 h-4 shrink-0 text-destructive-ink mt-0.5" aria-hidden />
      <p>
        <strong>Zapomnianego hasła nie da się odzyskać.</strong> Nie ma resetu ani konta, które mogłoby to zrobić — treść jest
        szyfrowana tylko na Twoich urządzeniach. Bez hasła (albo kodu awaryjnego) zablokowane notatki są nie do odczytania.
      </p>
    </div>
  );
}

function errorText(err: unknown): string {
  if (err instanceof VaultThrottledError) {
    const s = Math.max(1, Math.ceil((err.retryAt - Date.now()) / 1000));
    return `Za dużo prób. Spróbuj ponownie za ${s < 90 ? `${s} s` : `${Math.ceil(s / 60)} min`}.`;
  }
  if (err instanceof VaultError) {
    if (err.code === "bad-password") return "Nieprawidłowe hasło.";
    if (err.code === "bad-recovery") return "Nieprawidłowy kod awaryjny.";
    if (err.code === "weak-params") return "Skarbiec ma zbyt słabe parametry szyfrowania — odrzucono ze względów bezpieczeństwa.";
  }
  return err instanceof Error ? err.message : "Coś poszło nie tak.";
}

function useRetryCountdown() {
  const [ms, setMs] = useState(() => privateNotes.retryInMs());
  useEffect(() => {
    if (ms <= 0) return;
    const t = setTimeout(() => setMs(privateNotes.retryInMs()), Math.min(1000, ms));
    return () => clearTimeout(t);
  }, [ms]);
  return { ms, refresh: () => setMs(privateNotes.retryInMs()) };
}

// ── odblokowanie ──────────────────────────────────────────────────────────────

function UnlockForm({ onUnlocked, onRecover }: { onUnlocked: () => void; onRecover: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { ms, refresh } = useRetryCountdown();
  const hasRecovery = privateNotes.hasRecovery();
  const wait = Math.ceil(ms / 1000);

  // Ten sam skarbiec mógł zostać odblokowany z innego miejsca (np. po synchronizacji).
  const done = useRef(onUnlocked);
  done.current = onUnlocked;
  useEffect(() => { if (privateNotes.isUnlocked()) done.current(); }, []);

  /** Odblokowanie biometrią (V-4): ten sam przepływ co hasło, tylko z passkeyem. */
  async function biometric() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await privateNotes.unlockWithPasskey();
      setPassword("");
      onUnlocked();
    } catch (err) {
      setError(errorText(err));
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await privateNotes.unlock(password);
      setPassword("");
      onUnlocked();
    } catch (err) {
      setError(errorText(err));
      setPassword("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">Wpisz hasło skarbca. Klucz zostaje tylko w pamięci tej karty i znika po zablokowaniu.</p>
      {/* Ukryty login dla menedżera haseł (V-2): bez niego nie wie, do czego hasło. */}
      <input type="text" name="username" autoComplete="username" value="Skarbiec hydra" readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
      <div className="space-y-1.5">
        <Label htmlFor="vault-password">Hasło skarbca</Label>
        <Input id="vault-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || wait > 0} aria-invalid={!!error} aria-describedby={error ? "vault-error" : undefined} />
        {error && <p id="vault-error" role="alert" className="text-xs text-destructive-ink">{error}</p>}
        {wait > 0 && !error && <p role="status" className="text-xs text-muted-foreground">Za dużo błędnych prób — odczekaj {wait} s.</p>}
        {wait > 0 && error && !error.startsWith("Za dużo") && <p role="status" className="text-xs text-muted-foreground">Kolejna próba za {wait} s.</p>}
      </div>
      <ResponsiveDialogFooter className="gap-2 sm:justify-between">
        {hasRecovery ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRecover}>Mam kod awaryjny</Button>
        ) : <span />}
        {privateNotes.hasPasskeys() && passkeyApiAvailable() && (
          <Button type="button" variant="outline" disabled={busy || wait > 0} onClick={() => void biometric()}>Odblokuj biometrią</Button>
        )}
        <Button type="submit" disabled={busy || !password || wait > 0}>
          <KeyRound className="w-4 h-4 mr-1.5" />{busy ? "Sprawdzam…" : "Odblokuj"}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

// ── pierwsze użycie ───────────────────────────────────────────────────────────

function SetupForm({ onCreated }: { onCreated: (recoveryCode: string | null) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [withRecovery, setWithRecovery] = useState(true);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = strength.ok && password === confirm && ack && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { recoveryCode } = await privateNotes.setup(password, { withRecovery });
      onCreated(recoveryCode);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">Jedno hasło chroni wszystkie prywatne notatki. Szyfrowanie dzieje się w tej przeglądarce (AES-256).</p>
      <NoRecoveryWarning />
      <div className="space-y-1.5">
        <Label htmlFor="vault-new-password">Hasło skarbca</Label>
        <Input id="vault-new-password" type="password" autoFocus autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <StrengthMeter password={password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vault-confirm-password">Powtórz hasło</Label>
        <Input id="vault-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <p role="alert" className="text-xs text-destructive-ink">Hasła się różnią.</p>}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5 coarse:h-6 coarse:w-6" checked={withRecovery} onCheckedChange={(v) => setWithRecovery(v === true)} />
        <span>Wygeneruj kod awaryjny <span className="text-muted-foreground">— pokażę go raz; pozwoli wrócić do notatek po zapomnieniu hasła.</span></span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5 coarse:h-6 coarse:w-6" checked={ack} onCheckedChange={(v) => setAck(v === true)} />
        <span>Rozumiem, że zapomnianego hasła nie da się odzyskać.</span>
      </label>
      {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
      <ResponsiveDialogFooter>
        <Button type="submit" disabled={!canSubmit}>{busy ? "Szyfruję…" : "Ustaw hasło"}</Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

// ── zmiana hasła / reset kodem ────────────────────────────────────────────────

function NewPasswordFields({ password, setPassword, confirm, setConfirm }: { password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void }) {
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="vault-new-password">Nowe hasło</Label>
        <Input id="vault-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <StrengthMeter password={password} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="vault-confirm-password">Powtórz nowe hasło</Label>
        <Input id="vault-confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
        {mismatch && <p role="alert" className="text-xs text-destructive-ink">Hasła się różnią.</p>}
      </div>
    </>
  );
}

function ChangeForm({ onChanged }: { onChanged: (recoveryCode: string | null) => void }) {
  const [oldPw, setOldPw] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [withRecovery, setWithRecovery] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = !!oldPw && passwordStrength(password).ok && password === confirm && !busy;
  // Zmiana hasła kasuje odblokowania biometrią (stare opakowania wiążą stary klucz). Mówimy to przed zmianą.
  const hadPasskeys = privateNotes.hasPasskeys();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await privateNotes.changePassword(oldPw, password, { withRecovery });
      if (res.skipped.length) toast.warning(`${res.skipped.length} notatek prywatnych nie dało się odszyfrować i zostały bez zmian`);
      else toast.success("Hasło zmienione", { description: hadPasskeys ? "Odblokowanie biometrią trzeba dodać ponownie w Ustawieniach." : "Wszystkie prywatne notatki przeszyfrowano nowym kluczem." });
      onChanged(res.recoveryCode);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">Wszystkie zablokowane notatki zostaną przeszyfrowane nowym kluczem. Operacja jest atomowa — przy błędzie nic się nie zmienia.</p>
      {hadPasskeys && <p className="text-sm text-destructive-ink" role="note">Odblokowanie biometrią zostanie usunięte. Po zmianie dodasz je ponownie w Ustawieniach.</p>}
      <div className="space-y-1.5">
        <Label htmlFor="vault-old-password">Obecne hasło</Label>
        <Input id="vault-old-password" type="password" autoFocus autoComplete="current-password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
      </div>
      <NewPasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5 coarse:h-6 coarse:w-6" checked={withRecovery} onCheckedChange={(v) => setWithRecovery(v === true)} />
        <span>Wygeneruj nowy kod awaryjny <span className="text-muted-foreground">— stary przestanie działać.</span></span>
      </label>
      {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
      <ResponsiveDialogFooter>
        <Button type="submit" disabled={!canSubmit}>{busy ? "Przeszyfrowuję…" : "Zmień hasło"}</Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

function RecoverForm({ onBack, onDone }: { onBack: () => void; onDone: (recoveryCode: string | null) => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canSubmit = code.trim().length > 0 && passwordStrength(password).ok && password === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await privateNotes.resetPasswordWithRecovery(code, password);
      toast.success("Ustawiono nowe hasło");
      onDone(res.recoveryCode);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">Wpisz kod awaryjny i ustaw nowe hasło. Wygenerujemy też nowy kod — stary przestanie działać.</p>
      <div className="space-y-1.5">
        <Label htmlFor="vault-recovery-code">Kod awaryjny</Label>
        <Input id="vault-recovery-code" autoFocus autoComplete="off" spellCheck={false} placeholder="XXXX-XXXX-XXXX-…" className="font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <NewPasswordFields password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} />
      {error && <p role="alert" className="text-xs text-destructive-ink">{error}</p>}
      <ResponsiveDialogFooter className="gap-2 sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>Wróć</Button>
        <Button type="submit" disabled={!canSubmit}>{busy ? "Przeszyfrowuję…" : "Ustaw nowe hasło"}</Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

// ── kod awaryjny ──────────────────────────────────────────────────────────────

function RecoveryCodeStep({ code, onClose }: { code: string; onClose: () => void }) {
  const [saved, setSaved] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(code); toast.success("Skopiowano kod awaryjny"); } catch { toast.error("Nie udało się skopiować — przepisz kod ręcznie"); }
  }
  function download() {
    const blob = new Blob([`Kod awaryjny skarbca G\n\n${code}\n\nKto zna ten kod, może odblokować Twoje prywatne notatki. Trzymaj go osobno od urządzeń.\n`], { type: "text/plain" });
    downloadBlob(blob, "notki-kod-awaryjny.txt");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        To jedyny raz, kiedy widzisz ten kod. Zapisz go poza urządzeniem (wydruk, menedżer haseł). Kto go zna, może odblokować Twoje notatki.
      </p>
      <p data-testid="recovery-code" className="select-all rounded-lg border border-border bg-muted/40 px-3 py-3 text-center font-mono text-sm tracking-wider wrap-break-word">{code}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}><Copy className="w-3.5 h-3.5 mr-1.5" />Kopiuj</Button>
        <Button type="button" variant="outline" size="sm" onClick={download}><Download className="w-3.5 h-3.5 mr-1.5" />Pobierz .txt</Button>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox className="mt-0.5 coarse:h-6 coarse:w-6" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <span>Zapisałem kod w bezpiecznym miejscu.</span>
      </label>
      <ResponsiveDialogFooter>
        <Button type="button" disabled={!saved} onClick={onClose}>Gotowe</Button>
      </ResponsiveDialogFooter>
    </div>
  );
}
