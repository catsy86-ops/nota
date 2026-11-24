import { useEffect, useRef, useState } from "react";
import { haptic } from "@/lib/haptics";
import { suggestSites } from "@/lib/study/journalView";
import { setSite } from "@/lib/study/store";
import { patchJournalEditForm } from "@/lib/study/entrySheet";
import type { EntryForm } from "./entryForm";

/**
 * Pole budowy w arkuszu wpisu: tekst w trakcie pisania trafia do Yjs (albo formularza edycji) dopiero przy
 * zatwierdzeniu (blur, Enter, pigułka, zapis wpisu) — jeden zapis zamiast zapisu przy każdym klawiszu.
 */
export function useEntrySite({ site, studySite, isEdit, recentSites, reset, getForm, patch }: Pick<EntryForm, "getForm" | "patch"> & {
  site: string;
  /** Bieżąca budowa dokumentu (nowy wpis zapisuje do niej). */
  studySite: string;
  isEdit: boolean;
  recentSites: readonly string[];
  /** Zmiana tej wartości (otwarcie, zamknięcie, inny wpis) zamyka pole. */
  reset: unknown;
}) {
  const [editingSite, setEditingSite] = useState(false);
  /** Budowa w chwili otwarcia pola — dopóki jej nie zmienisz, pigułki pokazują wszystkie ostatnie. */
  const [siteAtOpen, setSiteAtOpen] = useState("");
  const [siteText, setSiteText] = useState("");
  /** Niezatwierdzona budowa i tryb, w którym ją wpisano; `null` = pole zamknięte albo już zapisane. */
  const pendingSite = useRef<{ text: string; edit: boolean } | null>(null);

  useEffect(() => {
    // Arkusz zamknięty albo przełączony w trakcie pisania budowy: nowy wpis zachowuje wpisaną budowę
    // (jak szkic), a niezapisana poprawka wpisu przepada razem z całą edycją.
    const pending = pendingSite.current;
    pendingSite.current = null;
    if (pending && !pending.edit) setSite(pending.text);
    setEditingSite(false);
  }, [reset]);

  function openSiteEditor() {
    setSiteAtOpen(site);
    setSiteText(site);
    pendingSite.current = { text: site, edit: isEdit };
    setEditingSite(true);
  }

  function onSiteText(t: string) {
    setSiteText(t);
    pendingSite.current = { text: t, edit: isEdit };
  }

  function writeSite(next: string) {
    pendingSite.current = null;
    if (isEdit) patchJournalEditForm({ site: next });
    else if (next !== studySite) {
      setSite(next);
      // Punkt wybrany w aparacie należy do poprzedniej budowy — przy innej zostałby cudzym punktem we wpisie.
      if (getForm().point) patch({ point: undefined });
    }
  }

  function commitSite() {
    if (pendingSite.current) writeSite(pendingSite.current.text);
    setEditingSite(false);
  }

  function pickSite(next: string) {
    writeSite(next);
    haptic("selection");
    setEditingSite(false);
  }

  const siteChips = editingSite
    ? suggestSites(recentSites, siteText === siteAtOpen ? "" : siteText, siteText)
    : !site ? suggestSites(recentSites, "", "", 3) : [];

  return { editingSite, siteText, onSiteText, openSiteEditor, commitSite, pickSite, siteChips };
}
