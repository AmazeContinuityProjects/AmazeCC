import { describe, expect, it, afterEach } from "vitest";
import { useState } from "react";
import { Provider, createStore, type createStore as CreateStore } from "jotai";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  DashboardNavigatorProvider,
  useDashboardNavigator,
} from "../components/custom/dashboard/DashboardNavigator";
import { useDashboardScreenHistory } from "../components/custom/dashboard/useDashboardScreenHistory";
import { useOverlayBack } from "../lib/overlayStack";

/**
 * System back (Android predictive back) walks browser history; this hook is
 * what keeps that history aligned with the navigator's selected screen, and the
 * overlay stack is what keeps it aligned with the sheets on top of it.
 *
 * The contract that matters on a phone: every step the user took is still
 * reachable by back, however deep the session got — and no gesture is spent on
 * a step that does not move. Both used to break the moment a sheet was closed
 * with its X: its history entry stayed behind with nothing left to dismiss, so
 * the next gesture landed on it and did nothing. Two or three of those in a
 * session and the stack looked like it only remembered the last step or two.
 */

afterEach(cleanup);

interface NavSnapshot {
  tab: string;
  attendance: string;
  sub: string;
  tools: string;
  profile: string;
}

/** Drives the sheets the way the app does: through the parent's open list. */
const sheets = {
  open: (_id: string) => {},
  close: (_id: string) => {},
};

/** One mounted sheet, exactly as `BottomSheet` registers and unregisters. */
function Sheet({ id }: { id: string }) {
  const [open, setOpen] = useState(true);
  useOverlayBack(id, open, () => {
    setOpen(false);
    sheets.close(id);
  });
  return null;
}

function Harness() {
  useDashboardScreenHistory();
  const nav = useDashboardNavigator();
  const [open, setOpen] = useState<string[]>([]);
  sheets.open = (id) => setOpen((cur) => [...cur, id]);
  sheets.close = (id) => setOpen((cur) => cur.filter((x) => x !== id));

  const snapshot: NavSnapshot = {
    tab: nav.activeTab,
    attendance: nav.activeAttendanceSubTab,
    sub: nav.activeSubTab,
    tools: nav.activeToolsSubTab,
    profile: nav.activeProfileSubTab,
  };
  return (
    <div>
      <span data-testid="screen">{JSON.stringify(snapshot)}</span>
      <span data-testid="sheets">{open.join(",")}</span>
      {open.map((id) => (
        <Sheet key={id} id={id} />
      ))}
      <button data-testid="to-attendance" onClick={() => nav.setActiveTab("attendance")}>a</button>
      <button data-testid="to-academics" onClick={() => nav.setActiveTab("academics")}>b</button>
      <button data-testid="to-profile" onClick={() => nav.setActiveTab("profile")}>c</button>
      <button data-testid="to-tools" onClick={() => nav.setActiveTab("tools")}>d</button>
    </div>
  );
}

function renderHarness(store: ReturnType<typeof CreateStore>) {
  return render(
    <Provider store={store}>
      <DashboardNavigatorProvider>
        <Harness />
      </DashboardNavigatorProvider>
    </Provider>
  );
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function settle() {
  await act(async () => {
    await tick();
  });
}

/**
 * One system back gesture: `history.back()`, then wait for it to settle.
 *
 * Waiting on popstate rather than on the screen is deliberate — a gesture the
 * app failed to answer is exactly the bug under test, and that has to show up
 * as an unchanged screen rather than as a hung wait. The app may chain extra
 * pops within one gesture (walking past entries an in-app close left behind),
 * so the wait runs until no further popstate fires for a few ticks.
 */
async function back() {
  let pops = 0;
  const onPop = () => {
    pops += 1;
  };
  window.addEventListener("popstate", onPop);
  await act(async () => {
    window.history.back();
    let last = -1;
    let idle = 0;
    for (let i = 0; i < 60 && idle < 3; i += 1) {
      await tick();
      if (pops === last) idle += 1;
      else {
        last = pops;
        idle = 0;
      }
    }
  });
  window.removeEventListener("popstate", onPop);
  await settle();
}

function tab(): string {
  return JSON.parse(screen.getByTestId("screen").textContent as string).tab;
}

function openSheets(): string {
  return screen.getByTestId("sheets").textContent as string;
}

async function tap(id: string) {
  await act(async () => {
    screen.getByTestId(id).click();
    await tick();
  });
}

async function openSheet(id: string) {
  await act(async () => {
    sheets.open(id);
    await tick();
  });
}

async function closeSheet(id: string) {
  await act(async () => {
    sheets.close(id);
    await tick();
  });
}

describe("dashboard screen history", () => {
  it("walks back through four visited screens", async () => {
    renderHarness(createStore());
    await settle();
    expect(tab()).toBe("home");

    for (const id of ["to-attendance", "to-academics", "to-profile", "to-tools"]) await tap(id);
    expect(tab()).toBe("tools");

    await back();
    expect(tab()).toBe("profile");
    await back();
    expect(tab()).toBe("academics");
    await back();
    expect(tab()).toBe("attendance");
    await back();
    expect(tab()).toBe("home");
  });

  it("keeps every step walkable after sheets are closed in-app", async () => {
    renderHarness(createStore());
    await settle();

    // Three screens, each visited with a sheet opened and dismissed by its X —
    // the common phone session, and the one that used to leave three dead
    // entries behind.
    for (const [tabId, sheetName] of [
      ["to-attendance", "attendance-sheet"],
      ["to-academics", "academics-sheet"],
      ["to-profile", "profile-sheet"],
    ] as const) {
      await tap(tabId);
      await openSheet(sheetName);
      await closeSheet(sheetName);
    }
    expect(tab()).toBe("profile");

    // Not one gesture may be spent on a step that does not move.
    await back();
    expect(tab()).toBe("academics");
    await back();
    expect(tab()).toBe("attendance");
    await back();
    expect(tab()).toBe("home");
  });

  it("dismisses stacked sheets one gesture at a time, then leaves the screen", async () => {
    renderHarness(createStore());
    await settle();

    await tap("to-attendance");
    await openSheet("outer");
    await openSheet("inner");
    expect(openSheets()).toBe("outer,inner");

    // One gesture per sheet, in LIFO order.
    await back();
    expect(openSheets()).toBe("outer");
    await back();
    expect(openSheets()).toBe("");
    // And the next one is a real step, not a leftover entry.
    await back();
    expect(tab()).toBe("home");
  });

  it("loses no step when a stacked sheet is dismissed by its X", async () => {
    renderHarness(createStore());
    await settle();

    await tap("to-attendance");
    await openSheet("outer");
    await openSheet("inner");

    // Close the inner one in-app: its entry becomes the outer sheet's, so the
    // stack still holds exactly one entry per live step.
    await closeSheet("inner");

    await back();
    expect(openSheets()).toBe("");
    await back();
    expect(tab()).toBe("home");
  });
});
