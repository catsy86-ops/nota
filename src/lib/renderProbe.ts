// Licznik renderów do pomiarów (A2.5). Nic nie robi, dopóki test nie ustawi `window.__renderProbe = {}`
// (Playwright: `addInitScript`). Profiler Reacta w buildzie produkcyjnym niczego nie zwraca, a e2e działa na buildzie.
type Probe = Record<string, number>;

export function countRender(name: string): void {
  const probe = (globalThis as { __renderProbe?: Probe }).__renderProbe;
  if (probe) probe[name] = (probe[name] ?? 0) + 1;
}
