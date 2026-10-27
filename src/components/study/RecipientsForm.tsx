import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { saveBoss, saveGroup, type Boss, type WaGroup } from "@/lib/study/store";
import { formatPhone } from "@/lib/study/boss";

const fieldClass =
  "h-9 min-w-0 w-full rounded-control border border-input bg-background px-2 text-base focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:h-11 md:text-sm";

/**
 * Odbiorcy raportu w WhatsApp — szef (numer) i grupa; zapisani w danych Pracy, więc są na każdym sparowanym
 * telefonie. Wspólni dla wszystkich budów: ten sam formularz w oknie raportu i w karcie budowy (1.11).
 */
export function RecipientsForm({ boss, group, onDone, className }: { boss: Boss | null; group: WaGroup | null; onDone: () => void; className?: string }) {
  const [name, setName] = useState(boss?.name ?? "");
  const [phone, setPhone] = useState(boss ? formatPhone(boss.phone) : "");
  const [groupName, setGroupName] = useState(group?.name ?? "");
  const [groupLink, setGroupLink] = useState(group?.link ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const [linkError, setLinkError] = useState(false);
  function save() {
    const phoneOk = saveBoss(name, phone);
    const linkOk = saveGroup(groupName, groupLink);
    setPhoneError(!phoneOk);
    setLinkError(!linkOk);
    if (!phoneOk || !linkOk) return;
    haptic("success");
    toast.success("Zapisano odbiorców");
    onDone();
  }
  return (
    <form
      className={cn("space-y-4", className ?? "border-b border-border px-5 py-4 sm:px-6")}
      aria-label="Odbiorcy raportu w WhatsApp"
      onSubmit={(ev) => { ev.preventDefault(); save(); }}
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Szef</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Imię
            <input value={name} onChange={(ev) => setName(ev.target.value)} autoComplete="name" placeholder="np. Marek" className={cn(fieldClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Numer WhatsApp
            <input
              value={phone}
              onChange={(ev) => { setPhone(ev.target.value); setPhoneError(false); }}
              type="tel" inputMode="tel" autoComplete="tel" placeholder="600 100 200"
              aria-invalid={phoneError}
              aria-describedby="boss-phone-hint"
              className={cn(fieldClass, "mt-1 font-mono tabular-nums", phoneError && "border-destructive")}
            />
          </label>
        </div>
        <p id="boss-phone-hint" className={cn("text-xs", phoneError ? "text-destructive-ink" : "text-muted-foreground")}>
          {phoneError
            ? "To nie wygląda na numer — 9 cyfr albo z kierunkowym, np. +48 600 100 200."
            : "Raport otworzy się w czacie z szefem — wysyłasz Ty. Pusty numer usuwa szefa."}
        </p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Grupa</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-muted-foreground">
            Nazwa grupy
            <input value={groupName} onChange={(ev) => setGroupName(ev.target.value)} placeholder="np. Brygada Lipowa" className={cn(fieldClass, "mt-1")} />
          </label>
          <label className="text-xs text-muted-foreground">
            Link zaproszenia (opcjonalnie)
            <input
              value={groupLink}
              onChange={(ev) => { setGroupLink(ev.target.value); setLinkError(false); }}
              // Bez `type="url"`: link bez „https://” zatrzymałaby walidacja przeglądarki — `normalizeGroupLink` go przyjmuje.
              inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="chat.whatsapp.com/…"
              aria-invalid={linkError}
              aria-describedby="group-link-hint"
              className={cn(fieldClass, "mt-1", linkError && "border-destructive")}
            />
          </label>
        </div>
        <p id="group-link-hint" className={cn("text-xs", linkError ? "text-destructive-ink" : "text-muted-foreground")}>
          {linkError
            ? "To nie jest link grupy — w WhatsApp: grupa → Zaproś przez link → Kopiuj."
            : "Raport ze zdjęciami idzie przez „Udostępnij” — w WhatsApp wybierz tę grupę. Link przydaje się, gdy telefon nie ma udostępniania. Pusta nazwa usuwa grupę."}
        </p>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} className="coarse:h-11">Anuluj</Button>
      </div>
    </form>
  );
}
