# 03 — Writing a Unit Test

> **In one line:** test behavior and values, not mocks of internals.

```ts
import { describe, expect, it } from "vitest";
import { installLocalStorage } from "./helpers/localStorage";
import { parseReportRows } from "@/lib/ffcsReports";

installLocalStorage();

describe("parseReportRows", () => {
  it("maps VTOP csv to ParsedCourse", () => {
    const rows = parseReportRows(csvText);
    expect(rows[0]).toMatchObject({ code: "CH20262705", credits: 4 });
  });
});
```

Patterns:

- fixture rows from real CSV files committed under `public/ffcs/` (never invent tidy fixtures — real data teaches real bugs)
- `expect().toEqual()` for shape, `toBe()` for scalars
- pure-function tests stay DOM-free — no `installLocalStorage` needed
- snapshots: never (they rot); behavior assertions only
