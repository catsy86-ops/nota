import { describe, expect, it, vi } from "vitest";
import { LAUNCH_FILES_EVENT, setupFileLaunch, takeLaunchFiles } from "./fileLaunch";

function fakeWindow(withQueue: boolean) {
  const target = new EventTarget();
  let consumer: ((p: { files: { getFile(): Promise<File> }[] }) => void) | null = null;
  const win = Object.assign(target, {
    launchQueue: withQueue ? { setConsumer: (c: typeof consumer) => { consumer = c; } } : undefined,
  });
  return { win: win as unknown as Window, target, send: (files: { getFile(): Promise<File> }[]) => consumer?.({ files }) };
}

describe("setupFileLaunch", () => {
  it("bez launchQueue (inna przeglądarka) nic nie robi", () => {
    const { win } = fakeWindow(false);
    expect(() => setupFileLaunch(win)).not.toThrow();
    expect(takeLaunchFiles()).toEqual([]);
  });

  it("plik otwarty z systemu trafia do bufora i zapowiada to zdarzeniem", async () => {
    const { win, target, send } = fakeWindow(true);
    const onEvent = vi.fn();
    target.addEventListener(LAUNCH_FILES_EVENT, onEvent);
    setupFileLaunch(win);

    const file = new File(["# Test"], "notatka.md", { type: "text/markdown" });
    send([{ getFile: async () => file }]);
    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledTimes(1));

    const taken = takeLaunchFiles();
    expect(taken.map((f) => f.name)).toEqual(["notatka.md"]);
    expect(takeLaunchFiles()).toEqual([]);
  });

  it("pusta kolejka nie zapowiada niczego", async () => {
    const { win, target, send } = fakeWindow(true);
    const onEvent = vi.fn();
    target.addEventListener(LAUNCH_FILES_EVENT, onEvent);
    setupFileLaunch(win);
    send([]);
    await Promise.resolve();
    expect(onEvent).not.toHaveBeenCalled();
  });
});
