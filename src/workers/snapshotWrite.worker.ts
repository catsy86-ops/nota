/// <reference lib="webworker" />
/**
 * Zapis pliku kopii dziennej w OPFS przez `createSyncAccessHandle` (Q1.4, `docs/plan-dane-lokalne.md` §1.4) — dla
 * przeglądarek bez `createWritable` w wątku strony (Safari). Plik jest nowy (dzisiejszego nie było albo był uszkodzony),
 * a strona po zapisie czyta go i sprawdza skrót, więc przerwany zapis kończy się plikiem „uszkodzona”, nie cichą stratą.
 */
interface SyncHandle {
  truncate(size: number): void;
  write(data: Uint8Array, opts: { at: number }): number;
  flush(): void;
  close(): void;
}

self.onmessage = async (e: MessageEvent<{ dir: string; name: string; bytes: Uint8Array }>) => {
  const { dir, name, bytes } = e.data;
  try {
    const root = await navigator.storage.getDirectory();
    const folder = await root.getDirectoryHandle(dir, { create: true });
    const file = await folder.getFileHandle(name, { create: true });
    const handle = await (file as unknown as { createSyncAccessHandle(): Promise<SyncHandle> }).createSyncAccessHandle();
    try {
      handle.truncate(0);
      handle.write(bytes, { at: 0 });
      handle.flush();
    } finally {
      handle.close();
    }
    self.postMessage({ ok: true });
  } catch (err) {
    self.postMessage({ ok: false, name: (err as Error)?.name ?? "Error", message: String((err as Error)?.message ?? err) });
  }
};
