// Wejście i wyjście nakładek (M3.3) — jedno miejsce zamiast kopii w każdym komponencie.
// Czasy z tokenów (`duration-base` wejście, `duration-fast` wyjście), zob. docs/ruch.md.

/** Przyciemnienie za oknem lub arkuszem: samo zanikanie. */
export const OVERLAY_FADE =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:duration-base data-[state=closed]:duration-fast";

/** Dymek przy elemencie (popover, menu, podpowiedź): zanikanie, lekkie powiększenie i wsunięcie od strony kotwicy. */
export const POPUP_MOTION =
  "duration-fast ease-out-soft data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2";
