import { useState } from "react";
import { pairCodeFromLocation } from "@/lib/pairLink";
import { settingsTabFromParam, SETTINGS_PARAM } from "@/lib/settingsDeepLink";

/**
 * Stan okien strony głównej („otwarte?”), ustawiany z wielu miejsc: paska bocznego, nagłówka, palety, skrótów
 * i linków (`?pair=`, `?settings=`). Same okna montuje `IndexDialogs` (i paletę `Index.tsx`).
 */
export function useAppDialogs() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Link z kodu QR (`?pair=…`) otwiera Ustawienia → Sync; kod odczytuje i usuwa z adresu
  // `SettingsDialog`, który montuje się dopiero po otwarciu.
  // Link `?settings=<karta>` (faza 3c) otwiera Ustawienia od razu na tej karcie.
  const [settingsOpen, setSettingsOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return pairCodeFromLocation(window.location.search, window.location.hash) !== null || settingsTabFromParam(params.get(SETTINGS_PARAM)) !== null;
  });
  const [statsOpen, setStatsOpen] = useState(false);
  /** Skrzynka 2.3: małe okno „Do skrzynki” (Alt+K, paleta, skrót PWA) — widok pod spodem zostaje. */
  const [quickInboxOpen, setQuickInboxOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [propDefsOpen, setPropDefsOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);

  return {
    paletteOpen, setPaletteOpen, actionsOpen, setActionsOpen, settingsOpen, setSettingsOpen, statsOpen, setStatsOpen,
    quickInboxOpen, setQuickInboxOpen, shortcutsOpen, setShortcutsOpen, propDefsOpen, setPropDefsOpen, focusModeOpen, setFocusModeOpen,
  };
}

export type AppDialogs = ReturnType<typeof useAppDialogs>;
