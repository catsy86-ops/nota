import { describe, it, expect, beforeEach } from "vitest";
import {
  logSecurity, getSecurityEvents, clearSecurityForTests, clearDiagForTests, sanitizeDetail,
  buildDiagReport, SECURITY_LOG_MAX, installGlobalDiagHandlers, type DiagSnapshot,
} from "@/lib/diagnostics";
import { redactServerUrl } from "@/lib/diagnosticsReport";

const snapshot: DiagSnapshot = {
  build: "t", generatedAt: "2026-01-01T00:00:00Z", userAgent: "ua", online: true, serviceWorker: "x",
  storage: { usage: 1, quota: 2, persisted: true },
  counts: { notes: 0, archived: 0, trashed: 0, folders: 0, labels: 0 },
  stateVectorBytes: 0,
  sync: { status: "disabled", peerCount: 0, paired: false, lastSyncedAt: null, lastError: null },
};

beforeEach(() => {
  clearDiagForTests();
  clearSecurityForTests();
  localStorage.clear();
});

describe("dziennik zdarzeń bezpieczeństwa (A09)", () => {
  it("zapisuje zdarzenie, scala kolejne identyczne i trzyma limit", () => {
    logSecurity("vault-unlock-failed", "hasło");
    logSecurity("vault-unlock-failed", "hasło");
    expect(getSecurityEvents()).toHaveLength(1);
    expect(getSecurityEvents()[0].count).toBe(2);
    for (let i = 0; i < SECURITY_LOG_MAX + 20; i++) logSecurity("csp-violation", `img-src ${i}`);
    expect(getSecurityEvents()).toHaveLength(SECURITY_LOG_MAX);
  });

  it("jest trwały między przeładowaniami (localStorage)", () => {
    logSecurity("rejected-peer-blob", "hash mismatch");
    const raw = JSON.parse(localStorage.getItem("kaczy.security.log.v1")!);
    expect(raw[0].kind).toBe("rejected-peer-blob");
  });

  it("detal nie zawiera ścieżek ani zapytań adresów ani znaków sterujących", () => {
    expect(sanitizeDetail("img-src https://evil.example/path/x.png?token=SEKRET")).toBe("img-src https://evil.example");
    expect(sanitizeDetail("a\nb\u0000c")).toBe("a b c");
    expect(sanitizeDetail("x".repeat(1000))).toHaveLength(160);
  });

  it("trafia do raportu, a adres serwera sygnalizacyjnego jest zredagowany", () => {
    logSecurity("vault-unlock-failed", "3 próby");
    const report = buildDiagReport(snapshot, [], [], getSecurityEvents());
    expect(report).toContain("zdarzenia bezpieczeństwa (1");
    expect(report).toContain("vault-unlock-failed");
    expect(redactServerUrl("wss://user:pass@sig.example.com:4444/room?token=abc")).toBe("wss://sig.example.com:4444");
    expect(redactServerUrl("nie url")).toBe("[nieprawidłowy adres]");
  });

  it("naruszenie CSP z dokumentu ląduje w dzienniku", () => {
    installGlobalDiagHandlers();
    const ev = new Event("securitypolicyviolation") as Event & { violatedDirective: string; blockedURI: string };
    ev.violatedDirective = "img-src";
    ev.blockedURI = "https://tracker.example/pixel.gif?id=1";
    document.dispatchEvent(ev);
    expect(getSecurityEvents().at(-1)).toMatchObject({ kind: "csp-violation", detail: "img-src https://tracker.example" });
  });
});
