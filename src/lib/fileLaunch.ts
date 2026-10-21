/**
 * Otwieranie plików z systemu (File Handling API, `file_handlers` w manifeście): plik .md,
 * .json albo .zip kliknięty w Eksploratorze / Finderze trafia do importu, jeśli aplikacja jest
 * zainstalowana i przeglądarka to wspiera (Chromium). Gdzie indziej nic się nie dzieje.
 *
 * `launchQueue` może wywołać konsumenta, zanim React zamontuje import — dlatego pliki czekają
 * w buforze do `takeLaunchFiles()` i dostaje je hook `useExternalImport` przy montowaniu.
 */
export const LAUNCH_FILES_EVENT = "kaczy:launch-files";

interface LaunchParamsLike {
  files: FileSystemFileHandle[];
}

interface LaunchQueueLike {
  setConsumer(consumer: (params: LaunchParamsLike) => void): void;
}

let pending: File[] = [];

/** Podłącza konsumenta kolejki startowej; bez `launchQueue` (inne przeglądarki) nic nie robi. */
export function setupFileLaunch(win: Window = window): void {
  const queue = (win as Window & { launchQueue?: LaunchQueueLike }).launchQueue;
  if (!queue) return;
  queue.setConsumer(async (params) => {
    const files = await Promise.all(params.files.map((handle) => handle.getFile()));
    if (!files.length) return;
    pending = [...pending, ...files];
    win.dispatchEvent(new Event(LAUNCH_FILES_EVENT));
  });
}

/** Oddaje plik(i) czekające na import i czyści bufor. */
export function takeLaunchFiles(): File[] {
  const files = pending;
  pending = [];
  return files;
}
