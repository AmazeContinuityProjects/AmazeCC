import { describe, expect, it } from "vitest";
import { buildRegisteredShareLink } from "../lib/timetableShareLink";
import { decodeNumericTimetableShapeShare, decodeTimetableShapeShare } from "../lib/ffcsShare";
import type { attendanceRes } from "../types/data/attendance";

const item = (courseCode: string, classId: string | null) =>
  ({ courseCode, classId, courseTitle: courseCode, slotName: "A1" }) as NonNullable<
    attendanceRes["attendance"]
  >[number];

function decode(url: string) {
  const u = new URL(url);
  const r = u.searchParams.get("r");
  const q = u.searchParams.get("q");
  return r ? decodeNumericTimetableShapeShare(r) : q ? decodeTimetableShapeShare(q) : null;
}

describe("buildRegisteredShareLink", () => {
  const winter: attendanceRes = {
    attendance: [
      item("BACSE211", "CH2026270501792"),
      item("BACSE211", "CH2026270501800"),
      item("BAMAT101", "CH2026270500101"),
    ],
  };

  it("turns the registered class ids into a link that decodes back to the same ids", () => {
    const link = buildRegisteredShareLink(winter, "https://amazecc.com")!;
    expect(link).not.toBeNull();
    expect(link.semester).toBe("winter-2026-2027");
    expect(link.classCount).toBe(3);
    expect(link.url.startsWith("https://amazecc.com/share/ffcs/?")).toBe(true);
    const decoded = decode(link.url);
    expect(decoded).not.toBeNull();
    expect([...decoded!.classIds].sort()).toEqual(["CH2026270500101", "CH2026270501792", "CH2026270501800"]);
  });

  it("maps a fall timetable to the fall report", () => {
    const link = buildRegisteredShareLink({ attendance: [item("BAMAT101", "CH2026270100011")] }, "https://amazecc.com");
    expect(link?.semester).toBe("fall-2026-2027");
  });

  it("leaves out courses without a usable class id, and says which", () => {
    const link = buildRegisteredShareLink(
      { attendance: [item("BACSE211", "CH2026270501792"), item("BASTS102", null), item("BAX", "junk")] },
      "https://amazecc.com",
    );
    expect(link?.classCount).toBe(1);
    expect(link?.skipped).toEqual(["BASTS102", "BAX"]);
  });

  it("returns null when there is nothing to share", () => {
    expect(buildRegisteredShareLink(undefined, "https://amazecc.com")).toBeNull();
    expect(buildRegisteredShareLink({ attendance: [] }, "https://amazecc.com")).toBeNull();
    expect(buildRegisteredShareLink({ attendance: [item("X", null)] }, "https://amazecc.com")).toBeNull();
  });
});
