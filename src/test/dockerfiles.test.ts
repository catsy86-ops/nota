import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Q2.3: serwery (push, przekaźnik, sygnalizacja) w kontenerze nie działają jako root i instalują wersje z lockfile.
const root = resolve(__dirname, "../..");
const SERVERS = ["push-server", "relay-server", "signaling-server"];

describe("Dockerfile serwerów (Q2.3)", () => {
  for (const dir of SERVERS) {
    it(`${dir}: USER node przed CMD, npm ci z package-lock.json`, () => {
      const src = readFileSync(resolve(root, dir, "Dockerfile"), "utf8");
      const user = src.search(/^USER node$/m);
      expect(user, "USER node").toBeGreaterThan(-1);
      expect(user).toBeLessThan(src.search(/^CMD /m));
      expect(src).toMatch(/^COPY package\.json package-lock\.json/m);
      expect(src).toMatch(/^RUN npm ci --omit=dev/m);
      expect(src).not.toMatch(/npm install/);
      expect(existsSync(resolve(root, dir, "package-lock.json"))).toBe(true);
    });
  }
});
