import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disablePush, enablePush, pushErrorText, sendTestPush, uploadSchedule } from "./client";
import { pushPrefs, updatePushPrefs } from "./prefs";

// Atrapa Web Push: subskrypcja, rejestracja Service Workera i serwer (fetch). T19 audytu: wcześniej klient miał 10% pokrycia.
const KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const toJSON = () => ({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } });

function setup(opts: { permission?: NotificationPermission; sub?: boolean } = {}) {
  const sub = { endpoint: "https://push.example/abc", toJSON, unsubscribe: vi.fn(async () => true), options: { applicationServerKey: null as ArrayBuffer | null } };
  const pushManager = {
    getSubscription: vi.fn(async () => (state.sub ? sub : null)),
    subscribe: vi.fn(async () => { state.sub = true; return sub; }),
  };
  const state = { sub: opts.sub ?? false };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
  vi.stubGlobal("Notification", { requestPermission: vi.fn(async () => opts.permission ?? "granted") });
  return { sub, pushManager, state };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  localStorage.clear();
  updatePushPrefs({ server: "https://srv.example", enabled: false, sentHash: undefined, last: undefined });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("push/client", () => {
  it("pushErrorText: komunikaty dla kodów serwera", () => {
    expect(pushErrorText(401)).toMatch(/token/i);
    expect(pushErrorText(429)).toMatch(/żądań/);
    expect(pushErrorText(413)).toMatch(/za duży/);
    expect(pushErrorText(503)).toBe("Serwer odpowiedział 503");
  });

  it("enablePush: odmowa zgody nie włącza powiadomień i nie woła serwera", async () => {
    setup({ permission: "denied" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(enablePush("https://srv.example")).rejects.toThrow(/zgody/);
    expect(pushPrefs.get().enabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enablePush: serwer niedostępny albo 5xx daje czytelny błąd i zostawia wyłączone", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await expect(enablePush("https://srv.example")).rejects.toThrow(/Brak połączenia/);
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 502)));
    await expect(enablePush("https://srv.example")).rejects.toThrow("Serwer odpowiedział 502");
    expect(pushPrefs.get().enabled).toBe(false);
  });

  it("enablePush: odpowiedź bez klucza to nie serwer powiadomień", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn(async () => json({ nope: 1 })));
    await expect(enablePush("https://srv.example")).rejects.toThrow(/nie jest serwer/);
  });

  it("enablePush: subskrybuje, sprawdza token żądaniem /schedule i włącza", async () => {
    const { pushManager } = setup();
    const fetchMock = vi.fn(async (url: string) => (String(url).endsWith("/vapid") ? json({ publicKey: KEY }) : json({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);
    await enablePush("https://srv.example", "sekret");
    expect(pushManager.subscribe).toHaveBeenCalledTimes(1);
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map((c) => c[0])).toEqual(["https://srv.example/vapid", "https://srv.example/schedule"]);
    expect((calls[1]![1].headers as Record<string, string>).Authorization).toBe("Bearer sekret");
    expect(pushPrefs.get()).toMatchObject({ enabled: true, server: "https://srv.example" });
  });

  it("enablePush: subskrypcja z innym kluczem serwera jest wymieniana", async () => {
    const { sub, pushManager } = setup({ sub: true });
    sub.options.applicationServerKey = new Uint8Array([1, 2, 3]).buffer; // inny niż KEY
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (String(url).endsWith("/vapid") ? json({ publicKey: KEY }) : json({}))));
    await enablePush("https://srv.example");
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it("disablePush: wyłącza lokalnie nawet gdy serwer nie odpowiada", async () => {
    const { sub } = setup({ sub: true });
    updatePushPrefs({ enabled: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await disablePush();
    expect(pushPrefs.get().enabled).toBe(false);
    expect(sub.unsubscribe).toHaveBeenCalled();
  });

  it("sendTestPush: bez subskrypcji rzuca, z subskrypcją woła /test", async () => {
    setup();
    await expect(sendTestPush()).rejects.toThrow(/Brak subskrypcji/);
    setup({ sub: true });
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await sendTestPush();
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://srv.example/test");
  });

  it("uploadSchedule: wyłączone push nic nie wysyła; bez zmian nie wysyła drugi raz", async () => {
    setup({ sub: true });
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await uploadSchedule([]);
    expect(fetchMock).not.toHaveBeenCalled();
    updatePushPrefs({ enabled: true });
    await uploadSchedule([]);
    await uploadSchedule([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pushPrefs.get().last).toMatchObject({ ok: true, count: 0 });
  });

  it("uploadSchedule: błąd serwera zapisuje komunikat i pozwala ponowić; keepalive jest przekazany", async () => {
    setup({ sub: true });
    updatePushPrefs({ enabled: true });
    const fetchMock = vi.fn(async () => json({}, 500));
    vi.stubGlobal("fetch", fetchMock);
    await uploadSchedule([], true);
    expect(pushPrefs.get().last).toMatchObject({ ok: false, error: "Serwer odpowiedział 500" });
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].keepalive).toBe(true);
    await uploadSchedule([]); // sentHash wyczyszczony → próbuje znowu
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uploadSchedule: brak subskrypcji zapisuje błąd bez wołania serwera", async () => {
    setup();
    updatePushPrefs({ enabled: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await uploadSchedule([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushPrefs.get().last?.ok).toBe(false);
  });
});
