import { test, expect } from "@playwright/test";

// PWA-specific checks that e2e/notes.spec.ts doesn't cover: these are exactly
// the kind of thing a plain CRUD test suite won't catch (see roadmap.md audit
// 2026-09-25) — manifest shape, service worker activation, and the app
// actually surviving a real network cut, not just a mocked one.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
});

test("registers a service worker that reaches the activated state", async ({ page }) => {
  await page.goto("/");
  // registerSW.ts reloads the page once on the very first controllerchange
  // (taking control for the first time counts as one) — that reload can
  // destroy an in-flight evaluate(), so tolerate exactly one retry for it.
  const evalActiveState = () =>
    page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      const active = reg.active;
      if (!active || active.state === "activated") return active?.state;
      return new Promise<string>((resolve) => {
        active.addEventListener("statechange", () => resolve(active.state));
      });
    });
  const state = await evalActiveState().catch(() => {
    return page.waitForLoadState("load").then(evalActiveState);
  });
  expect(state).toBe("activated");
});

test("manifest.webmanifest is valid and installable-shaped", async ({ page }) => {
  await page.goto("/");
  const manifestUrl = await page.evaluate(
    () => document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href
  );
  expect(manifestUrl).toBeTruthy();

  const manifest = await page.evaluate(async (url) => fetch(url!).then((r) => r.json()), manifestUrl);
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBeTruthy();
  expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThan(0);
  // Every declared icon must actually be that size — regression check for the
  // pwa-512.png (declared 512x512, was actually 816x816) bug found in the audit.
  for (const icon of manifest.icons) {
    const [w, h] = icon.sizes.split("x").map(Number);
    const dims = await page.evaluate(async (src) => {
      const img = new Image();
      const loaded = new Promise<{ w: number; h: number }>((resolve, reject) => {
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
      });
      img.src = src;
      return loaded;
    }, icon.src);
    expect(dims).toEqual({ w, h });
  }
});

test("app shell and existing notes survive a real offline reload", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("kaczy.tour.seen.v1", "1"));
  await page.goto("/");

  // Let the service worker finish installing/precaching before going offline —
  // a cold SW mid-install can't yet serve everything from cache.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });

  const title = `E2E-offline ${Date.now()}`;
  await page.getByText("Zapisz notatkę...").click();
  await page.getByPlaceholder("Tytuł").fill(title);
  await page.getByRole("button", { name: "Zamknij" }).click();
  await expect(page.getByText(title)).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload();
    // The app shell must render from the SW precache, not the offline.html
    // fallback — and the note must still be there, proving IndexedDB reads
    // work with zero network (this is the actual "used daily, no backend"
    // reliability property, not just static-asset caching).
    await expect(page.getByPlaceholder("Szukaj notatek...").first()).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
