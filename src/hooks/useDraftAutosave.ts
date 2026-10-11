import { useCallback, useEffect, useId, useRef } from "react";
import { setDraftDirty } from "@/lib/saveStatus";

interface DraftAutosaveOptions {
  /** Czy sesja edycji jest otwarta. Gdy `false`, hook nic nie robi. */
  active: boolean;
  /**
   * Odcisk bieżącej treści szkicu. Każda zmiana tej wartości restartuje
   * odliczanie, więc zapis następuje po przerwie w pisaniu, a nie w trakcie.
   */
  draftKey: string;
  /** Odstęp z Ustawień (`prefs.autosaveSeconds`); 0 = bez zapisu cyklicznego. */
  intervalSeconds: number;
  /** Zatwierdzenie szkicu. Musi być idempotentne i nie zamykać edytora. */
  onSave: () => void;
}

/**
 * Dwie niezależne siatki bezpieczeństwa dla edytowanej notatki:
 *
 * 1. Zapis po przerwie w pisaniu — tylko gdy użytkownik włączył autosave.
 * 2. Zapis przy odmontowaniu — **zawsze**, niezależnie od ustawienia.
 *    To ta druga jest właściwą naprawą utraty danych: kafel notatki potrafi
 *    zniknąć w trakcie edycji (wypadnięcie z filtra wyszukiwania, zmiana
 *    widoku, przesortowanie), a wtedy nikt nie klika „Zapisz”.
 */
export function useDraftAutosave({ active, draftKey, intervalSeconds, onSave }: DraftAutosaveOptions) {
  // Zapis czytamy z refów, żeby cleanup przy odmontowaniu nie widział
  // zestarzałego domknięcia nad szkicem.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const activeRef = useRef(active);
  activeRef.current = active;

  const draftId = useId();
  const baseKeyRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const draftKeyRef = useRef(draftKey);
  draftKeyRef.current = draftKey;
  /** Po zatwierdzeniu szkicu bieżąca treść staje się nową bazą — nie jest już „niezapisana”. */
  const markClean = useCallback(() => {
    baseKeyRef.current = draftKeyRef.current;
    dirtyRef.current = false;
    setDraftDirty(draftId, false);
  }, [draftId]);

  useEffect(() => {
    if (!active || intervalSeconds <= 0) return;
    const timer = setTimeout(() => { saveRef.current(); markClean(); }, intervalSeconds * 1000);
    return () => clearTimeout(timer);
  }, [active, intervalSeconds, draftKey, markClean]);

  useEffect(() => {
    return () => {
      if (activeRef.current) saveRef.current();
    };
  }, []);

  // Szkic „brudny” = otwarta sesja, w której treść różni się od tej z chwili otwarcia.
  // Zamknięcie karty nie odmontowuje komponentów, więc bez tego zmiany ginęły po cichu.
  useEffect(() => {
    if (!active) {
      baseKeyRef.current = null;
      dirtyRef.current = false;
      setDraftDirty(draftId, false);
      return;
    }
    if (baseKeyRef.current === null) baseKeyRef.current = draftKey;
    dirtyRef.current = draftKey !== baseKeyRef.current;
    setDraftDirty(draftId, dirtyRef.current);
  }, [active, draftKey, draftId]);
  useEffect(() => () => setDraftDirty(draftId, false), [draftId]);

  // Ukrycie karty / zamknięcie: zatwierdź szkic do dokumentu, póki jeszcze działa JS.
  useEffect(() => {
    const flush = () => {
      if (activeRef.current && dirtyRef.current) { saveRef.current(); markClean(); }
    };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [markClean]);
}
