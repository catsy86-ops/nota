import { useState } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NEW_CODE_TITLE } from "@/components/sync/NewCodeBanner";
import { clearV2Only, useV2Only, v2OnlyNotices } from "@/lib/sync/v2Window";
import { continueOnOldCode, getV2Until, resumeP2p, type NewCodeProposal } from "@/lib/yjsSync";
import { cardVariant } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const day = (ms: number) => format(ms, "dd.MM");


function newCodeReason(kind: Exclude<NewCodeProposal, null>): string {
  return kind === "legacy"
    ? "Ten kod był używany ze starszą wersją aplikacji, z której operator serwera pośredniczącego mógł odczytać kod."
    : "Ten kod był używany ze starszą wersją aplikacji, która słabiej ukrywała go przed serwerem pośredniczącym.";
}

/**
 * Propozycja nowego kodu (§2.3). Samą zmianę prowadzi panel „Zmiana kodu” niżej (`CodeChangePanel`);
 * synchronizacja działa dalej na obecnym kodzie, nic nie jest wymuszane.
 */
export function NewCodeCard({ kind }: { kind: Exclude<NewCodeProposal, null> }) {
  return (
    <div role="status" data-testid="new-code-card" className={cn(cardVariant("status", "warning"), "bg-warning/10 p-3 text-xs space-y-1")}>
      <h3 className="font-semibold text-foreground">{NEW_CODE_TITLE}</h3>
      <p className="text-muted-foreground">
        {newCodeReason(kind)} Nowy, dłuższy kod zamyka tę lukę. Po zmianie trzeba będzie ponownie sparować pozostałe urządzenia. Kod zmienisz w sekcji „Zmiana kodu” niżej.
      </p>
    </div>
  );
}

/** Z-15.5: połączenie bezpośrednie wstrzymane po nieprawidłowych danych od urządzenia; przekaźnik działa dalej. */
export function PeerPausedCard({ until, pausesToday }: { until: number; pausesToday: number }) {
  return (
    <div role="alert" data-testid="sync-p2p-paused" className={cn(cardVariant("status", "warning"), "bg-warning/10 p-3 text-xs space-y-2")}>
      <h3 className="font-semibold text-foreground">Urządzenie w grupie wysyła nieprawidłowe dane.</h3>
      <p className="text-muted-foreground">
        Połączenie bezpośrednie wstrzymane do {format(until, "HH:mm")}. Serwer pośredniczący, jeśli jest ustawiony, działa dalej.
        {pausesToday >= 2 && " Jeśli nie rozpoznajesz wszystkich urządzeń w grupie, zmień kod synchronizacji w sekcji „Zmiana kodu” niżej."}
      </p>
      <Button type="button" size="sm" variant="outline" onClick={resumeP2p} className="coarse:h-11">Wznów teraz</Button>
    </div>
  );
}

/** Stan `rekeyed` (§3.3 p. 5): kod zmieniono na innym urządzeniu, ta synchronizacja stoi. */
export function RekeyedCard({ onPairAgain }: { onPairAgain: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div role="alert" data-testid="sync-rekeyed" className={cn(cardVariant("status", "warning"), "bg-warning/10 p-3 text-xs space-y-2")}>
      <h3 className="font-semibold text-foreground">Kod synchronizacji został zmieniony na innym urządzeniu.</h3>
      <p className="text-muted-foreground">
        To urządzenie przestało wysyłać i odbierać zmiany. Twoje dane są bezpieczne na tym urządzeniu. Zeskanuj nowy kod
        z urządzenia, na którym go zmieniono — wszystkie zmiany połączą się same.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onPairAgain} className="coarse:h-11">Sparuj ponownie</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmOpen(true)} className="coarse:h-11">
          Synchronizuj dalej na starym kodzie
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Synchronizować dalej na starym kodzie?</AlertDialogTitle>
            <AlertDialogDescription>Rób to tylko, jeśli nikt z Twojej grupy nie zmieniał kodu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={() => continueOnOldCode()}>
              Synchronizuj dalej
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Urządzenia widziane tylko w pokoju v2 — stara wersja aplikacji (§2.2). W oknie zgodności: ostrzeżenie z datą końca;
 * po końcu: komunikat do ręcznego zamknięcia (znika też sam, gdy urządzenie pojawi się w pokoju v3).
 */
export function V2OnlyNotices() {
  const map = useV2Only();
  const until = getV2Until();
  if (until === null) return null;
  const now = Date.now();
  const active = now < until;
  const notices = v2OnlyNotices(map, active, now);
  if (notices.length === 0) return null;
  return (
    <ul className="space-y-1" aria-label="Urządzenia ze starą wersją aplikacji" data-testid="sync-v2only">
      {notices.map(({ name }) => (
        <li key={name} className="flex items-start gap-2 rounded-control border border-warning/50 bg-warning/10 px-3 py-2 text-xs text-foreground">
          <p className="min-w-0 flex-1">
            {active
              ? <>«{name}» ma starą wersję aplikacji. Zaktualizuj ją do {day(until)} — potem przestanie się synchronizować z tym urządzeniem.</>
              : <>«{name}» nie synchronizuje się od {day(until)} (stara wersja). Zaktualizuj aplikację na tym urządzeniu.</>}
          </p>
          {!active && (
            <Button
              type="button"
              onClick={() => clearV2Only(name)}
              aria-label={`Zamknij komunikat o urządzeniu ${name}`}
              variant="ghost" size="icon-sm" className="size-6 shrink-0 text-muted-foreground [&_svg]:size-3.5"
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
