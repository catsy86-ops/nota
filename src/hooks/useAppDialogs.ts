import { useCallback, useEffect, useMemo, useReducer, type SetStateAction } from "react";
import { pairCodeFromLocation } from "@/lib/pairLink";
import { requestSettingsTab, settingsTabFromParam, SETTINGS_PARAM, type SettingsTab } from "@/lib/settingsDeepLink";
import { SIGNALS } from "@/lib/storage/names";

/** Okna strony głównej przełączane „otwarte/zamknięte”. */
export type DialogName = "palette" | "actions" | "settings" | "stats" | "quickInbox" | "shortcuts" | "propDefs" | "focusMode" | "triage" | "emptyTrash";

export interface DialogsState {
  open: Record<DialogName, boolean>;
  /** Triaż Skrzynki zostaje zamontowany po pierwszym otwarciu (animacja zamknięcia, stan kroku). */
  triageMounted: boolean;
  /** Notatki czekające na potwierdzenie trwałego usunięcia (Kosz); `null` = okno zamknięte. */
  deleteIds: string[] | null;
}

export type DialogsAction =
  | { type: "set"; name: DialogName; open: SetStateAction<boolean> }
  | { type: "confirmDelete"; ids: string[] | null };

const CLOSED: Record<DialogName, boolean> = {
  palette: false, actions: false, settings: false, stats: false, quickInbox: false, shortcuts: false, propDefs: false, focusMode: false, triage: false, emptyTrash: false,
};

export function dialogsReducer(state: DialogsState, action: DialogsAction): DialogsState {
  if (action.type === "confirmDelete") return state.deleteIds === action.ids ? state : { ...state, deleteIds: action.ids };
  const prev = state.open[action.name];
  const next = typeof action.open === "function" ? action.open(prev) : action.open;
  if (next === prev) return state;
  return {
    ...state,
    open: { ...state.open, [action.name]: next },
    triageMounted: state.triageMounted || (action.name === "triage" && next),
  };
}

function initialState(): DialogsState {
  // Link z kodu QR (`?pair=…`) otwiera Ustawienia → Sync; kod odczytuje i usuwa z adresu `SettingsDialog`, który montuje
  // się dopiero po otwarciu. Link `?settings=<karta>` (faza 3c) otwiera Ustawienia od razu na tej karcie.
  const params = new URLSearchParams(window.location.search);
  const settings = pairCodeFromLocation(window.location.search, window.location.hash) !== null || settingsTabFromParam(params.get(SETTINGS_PARAM)) !== null;
  return { open: { ...CLOSED, settings }, triageMounted: false, deleteIds: null };
}

/**
 * Stan okien strony głównej („otwarte?”), ustawiany z wielu miejsc: paska bocznego, nagłówka, palety, skrótów
 * i linków (`?pair=`, `?settings=`). A2.4: jeden reduktor (`dialogsReducer`) zamiast osobnych `useState` w hooku i w `Index`;
 * settery zachowują kształt `setState`, więc wywołujący się nie zmienili. Okna montuje `IndexOverlays`.
 */
export function useAppDialogs() {
  const [state, dispatch] = useReducer(dialogsReducer, undefined, initialState);
  const setter = useCallback((name: DialogName) => (open: SetStateAction<boolean>) => dispatch({ type: "set", name, open }), []);
  const setters = useMemo(() => ({
    setPaletteOpen: setter("palette"),
    setActionsOpen: setter("actions"),
    setSettingsOpen: setter("settings"),
    setStatsOpen: setter("stats"),
    /** Skrzynka 2.3: małe okno „Do skrzynki” (Alt+K, paleta, skrót PWA) — widok pod spodem zostaje. */
    setQuickInboxOpen: setter("quickInbox"),
    setShortcutsOpen: setter("shortcuts"),
    setPropDefsOpen: setter("propDefs"),
    setFocusModeOpen: setter("focusMode"),
    setTriageOpen: setter("triage"),
    setConfirmEmptyTrash: setter("emptyTrash"),
    setConfirmDeleteIds: (ids: string[] | null) => dispatch({ type: "confirmDelete", ids }),
  }), [setter]);
  // U3.4: samouczek (i inne miejsca poza `Index`) otwierają Ustawienia na karcie sygnałem.
  useEffect(() => {
    function onOpen(e: Event) {
      const tab = (e as CustomEvent<SettingsTab | undefined>).detail;
      if (tab) requestSettingsTab(tab);
      dispatch({ type: "set", name: "settings", open: true });
    }
    window.addEventListener(SIGNALS.openSettings, onOpen);
    return () => window.removeEventListener(SIGNALS.openSettings, onOpen);
  }, []);
  const { open } = state;
  return {
    ...setters,
    paletteOpen: open.palette, actionsOpen: open.actions, settingsOpen: open.settings, statsOpen: open.stats,
    quickInboxOpen: open.quickInbox, shortcutsOpen: open.shortcuts, propDefsOpen: open.propDefs, focusModeOpen: open.focusMode,
    triageOpen: open.triage, triageMounted: state.triageMounted, confirmEmptyTrash: open.emptyTrash, confirmDeleteIds: state.deleteIds,
  };
}

export type AppDialogs = ReturnType<typeof useAppDialogs>;
