// Z-17.9: zestaw zbieżności w długim przebiegu (2000 losowych przebiegów na dział) — przed wydaniem, poza `npm test`.
import { spawnSync } from "node:child_process";

const runs = process.argv[2] ?? "2000";
const r = spawnSync("npx", ["vitest", "run", "src/test/convergence.test.ts", "convergence.prop.test.ts"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, CONVERGENCE_RUNS: runs },
});
process.exit(r.status ?? 1);
