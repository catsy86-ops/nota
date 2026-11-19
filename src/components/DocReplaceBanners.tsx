import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Info, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearReplaceResult, DATA_CLEARED_KEY, readReplaceResult, REPLACE_RESULT_KEY, type ReplaceResult } from "@/lib/docReplaceCore";
import { yjsStore } from "@/lib/yjsStore";
import { joinWithCode } from "@/lib/yjsSync";
import { pluralPl } from "@/lib/plural";

/** Ostatnia udana kopia dzienna (`dailySnapshot.ts`, `SNAPSHOT_LAST_KEY`) — klucz powtórzony, żeby nie ładować modułu kopii. */
const SNAPSHOT_LAST_KEY = "kaczy.snapshot.last.v1";
const DISMISSED_KEY = "kaczy.dataloss.dismissed.v1";

const box = "flex flex-wrap items-start gap-2 rounded-card border px-3 py-2 text-sm";
const when = (at: number) => format(at, "dd.MM, 'godz.' H:mm");

/**
 * Wynik wymiany całego dokumentu po przeładowaniu (Z-16.1B, `docs/plan-dane-lokalne.md` §1.6 p. 6). Przy
 * „Zastąp dane danymi grupy” tu następuje dołączenie kodem (dokument jest już pusty). Komunikat zostaje do zamknięcia.
 */
export function DocReplaceNotice({ onOpenSync }: { onOpenSync: () => void }) {
  const [result, setResult] = useState<ReplaceResult | null>(null);
  const joined = useRef(false);
  const [joinFailed, setJoinFailed] = useState(false);

  // Wynik zapisuje wymiana przy starcie — przed `ready()` jeszcze go nie ma (widok montuje się wcześniej).
  useEffect(() => {
    let cancelled = false;
    void yjsStore.ready().then(() => { if (!cancelled) setResult(readReplaceResult()); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!result?.ok || joined.current) return;
    const intent = result.intent;
    if (intent.kind !== "empty") return;
    joined.current = true;
    const { join, v3 } = intent;
    if (!join) return;
    void yjsStore.ready().then(() => {
      if (!joinWithCode(join, { v3 })) { setJoinFailed(true); return; }
      // Kod nie zostaje w zapisanym wyniku dłużej, niż trzeba — dopiero po udanym dołączeniu (inaczej nie ma ponowienia).
      const stored: ReplaceResult = { ...result, intent: { ...intent, join: "" } };
      try { localStorage.setItem(REPLACE_RESULT_KEY, JSON.stringify(stored)); } catch { /* ignore */ }
    });
  }, [result]);

  if (!result) return null;
  const close = () => { clearReplaceResult(); setResult(null); };
  const { intent } = result;

  if (!result.ok) {
    return (
      <div role="alert" data-testid="doc-replace-result" className={`${box} border-warning/50 bg-warning/10`}>
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
        <p className="min-w-0 flex-1">Nie przywrócono danych: {result.reason}. Dane na tym urządzeniu są bez zmian.</p>
        <Button type="button" variant="ghost" size="sm" onClick={close} className="coarse:h-11">Zamknij</Button>
      </div>
    );
  }

  return (
    <div role="status" data-testid="doc-replace-result" className={`${box} border-border/60 bg-muted/30`}>
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        {intent.kind === "snapshot"
          ? <>Przywrócono dane z {when(intent.createdAt)}. Kopia danych sprzed przywrócenia jest w Ustawieniach → Kopia i dane przez 30 dni.</>
          : joinFailed
            ? <>Dane na tym urządzeniu wyczyszczone, ale kod grupy jest nieprawidłowy — dołącz w Ustawieniach → Sync. Kopia poprzednich danych jest w Ustawieniach → Kopia i dane przez 30 dni.</>
            : <>Dane na tym urządzeniu zastąpione danymi grupy — pobieram je. Kopia poprzednich danych jest w Ustawieniach → Kopia i dane przez 30 dni.</>}
        {intent.kind === "snapshot" && intent.leftGroup && (
          <> To urządzenie opuściło grupę synchronizacji. Załóż nową grupę w Ustawieniach → Sync, a na pozostałych urządzeniach przy dołączaniu zaznacz „Zastąp dane na tym urządzeniu danymi grupy”.</>
        )}
      </p>
      <div className="flex shrink-0 gap-1">
        {((intent.kind === "snapshot" && intent.leftGroup) || joinFailed) && (
          <Button type="button" variant="ghost" size="sm" onClick={onOpenSync} className="coarse:h-11">Sync</Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={close} className="coarse:h-11">Zamknij</Button>
      </div>
    </div>
  );
}

function readNum(key: string): number | null {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * „Wygląda na to, że dane zniknęły” (§1.6, start z pustą bazą): dokument bez notatek, a ostatnia kopia dzienna miała
 * ich więcej niż zero i od tamtej pory nie było świadomego wyczyszczenia danych. Prowadzi do kopii dziennych.
 */
export function DataLossBanner({ onOpenBackup }: { onOpenBackup: () => void }) {
  const [last, setLast] = useState<{ date: number; notes: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void yjsStore.ready().then(() => {
      if (cancelled || yjsStore.notesMap.size > 0) return;
      let snap: { date?: unknown; notes?: unknown } | null = null;
      try { snap = JSON.parse(localStorage.getItem(SNAPSHOT_LAST_KEY) ?? "null"); } catch { /* brak */ }
      if (!snap || typeof snap.date !== "number" || typeof snap.notes !== "number" || snap.notes <= 0) return;
      const cleared = readNum(DATA_CLEARED_KEY);
      if (cleared !== null && cleared >= snap.date) return;
      if (readNum(DISMISSED_KEY) === snap.date) return;
      setLast({ date: snap.date, notes: snap.notes });
    });
    // Synchronizacja dociąga notatki po starcie — baner znika, zanim ktoś kliknie wymianę całego dokumentu.
    const onNotes = () => { if (yjsStore.notesMap.size > 0) setLast(null); };
    yjsStore.notesMap.observe(onNotes);
    return () => { cancelled = true; yjsStore.notesMap.unobserve(onNotes); };
  }, []);

  if (!last) return null;
  const dismiss = () => {
    try { localStorage.setItem(DISMISSED_KEY, String(last.date)); } catch { /* ignore */ }
    setLast(null);
  };

  return (
    <div role="alert" data-testid="data-loss" className={`${box} border-warning/50 bg-warning/10`}>
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden />
      <p className="min-w-0 flex-1">
        Wygląda na to, że dane zniknęły. Jest kopia z {format(last.date, "dd.MM")} ({last.notes} {pluralPl(last.notes, ["notatka", "notatki", "notatek"])}).
      </p>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenBackup} className="coarse:h-11">Kopie dzienne</Button>
        <Button type="button" variant="ghost" size="sm" onClick={dismiss} className="coarse:h-11">Zostaw</Button>
      </div>
    </div>
  );
}
