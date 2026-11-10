import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../lib/csp";

const directives = () =>
  Object.fromEntries(
    buildContentSecurityPolicy()
      .split(";")
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  );

describe("buildContentSecurityPolicy", () => {
  it("blocks plugins, base hijacking and eval", () => {
    const d = directives();
    expect(d["object-src"]).toEqual(["'none'"]);
    expect(d["base-uri"]).toEqual(["'self'"]);
    expect(d["script-src"]).not.toContain("'unsafe-eval'");
    expect(d["script-src"]).not.toContain("https:");
    expect(d["script-src"]).not.toContain("*");
  });

  it("allows the script hosts the app really loads", () => {
    const s = directives()["script-src"];
    for (const host of ["'self'", "https://www.googletagmanager.com", "https://shoot.amazecc.com", "https://cdn.jsdelivr.net"]) {
      expect(s).toContain(host);
    }
  });

  it("lets forms post only to this origin and EventHub", () => {
    expect(directives()["form-action"]).toEqual(["'self'", "https://eventhubcc.vit.ac.in"]);
  });

  it("keeps API calls open to custom https hosts", () => {
    expect(directives()["connect-src"]).toEqual(["'self'", "https:"]);
  });

  it("upgrades insecure requests", () => {
    expect(buildContentSecurityPolicy()).toMatch(/upgrade-insecure-requests$/);
  });
});
