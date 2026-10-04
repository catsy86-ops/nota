import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
    appinstalled: Event;
  }
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export interface PwaInstallState {
  /**
   * True whenever the app is not installed yet. Without a native prompt
   * (iOS, Firefox, Chrome before it decides to offer one) the button shows
   * manual steps instead — hiding it left phones with no way to install.
   */
  canInstall: boolean;
  /** True when the browser handed us a native install prompt. */
  hasNativePrompt: boolean;
  /** True when the app is already installed / running standalone. */
  isInstalled: boolean;
  /** True on iOS where there is no programmatic prompt — show manual instructions. */
  isIos: boolean;
  isAndroid: boolean;
  /** Trigger the native install prompt. Returns the user's choice, or null on iOS. */
  install: () => Promise<"accepted" | "dismissed" | null>;
}

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isInStandaloneMode());

  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return null;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  const ios = isIos();
  return {
    canInstall: !isInstalled,
    hasNativePrompt: deferredPrompt !== null,
    isInstalled,
    isIos: ios,
    isAndroid: isAndroid(),
    install,
  };
}
