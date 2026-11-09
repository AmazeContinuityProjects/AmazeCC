import { describe, expect, it } from "vitest";
import { classMatch, countClassesTogether, sharedClassesByCourse, sharedWithPeer } from "../lib/social/sharedClasses";
import { buildInviteLink, handleFromInvite, isValidHandle } from "../lib/social/handle";
import type { SocialCourse } from "../lib/social/types";

function course(over: Partial<SocialCourse>): SocialCourse {
  return {
    code: "BCSE302L",
    title: "Database Systems",
    venue: "SJT-401",
    ltpjc: "3 0 0 0 3",
    category: "Programme Core Courses",
    componentType: "Theory Only",
    classId: "CH2026270100001",
    faculty: "Dr. A",
    ...over,
  };
}

const dbmsMine = course({});
const dbmsLabMine = course({
  code: "BCSE302P",
  title: "Database Systems Lab",
  componentType: "Lab Only",
  classId: "CH2026270100002",
});
const osMine = course({ code: "BCSE303L", title: "Operating Systems", classId: "CH2026270100003" });

describe("classMatch", () => {
  it("is the same class when the class id matches", () => {
    expect(classMatch(dbmsMine, course({}))).toBe("same-class");
  });
  it("is the same course in another section when only the code matches", () => {
    expect(classMatch(dbmsMine, course({ classId: "CH2026270199999", faculty: "Dr. B" }))).toBe("same-course");
  });
  it("does not match theory against lab of the same code", () => {
    expect(classMatch(dbmsMine, course({ componentType: "Lab Only", classId: "X" }))).toBeNull();
  });
  it("does not match an unrelated course or an empty class id", () => {
    expect(classMatch(dbmsMine, course({ code: "BMAT101L", classId: "Y" }))).toBeNull();
    expect(classMatch(course({ classId: "" }), course({ classId: "", code: "ZZZ" }))).toBeNull();
  });
});

describe("sharedClassesByCourse", () => {
  const peers = [
    {
      handle: "AMZ-AAAA-AAAA",
      name: "Zara",
      loaded: true,
      courses: [course({}), course({ code: "BCSE303L", classId: "OTHER", faculty: "Dr. C" })],
    },
    { handle: "AMZ-BBBB-BBBB", name: "Arun", loaded: true, courses: [course({})] },
    { handle: "AMZ-CCCC-CCCC", name: "Not loaded", loaded: false, courses: [course({})] },
    { handle: "AMZ-DDDD-DDDD", name: "Coarse", loaded: true, courses: [] },
  ];

  it("groups peers per course, same class first, sorted by name, skipping courses nobody shares", () => {
    const rows = sharedClassesByCourse([osMine, dbmsLabMine, dbmsMine], peers);
    expect(rows.map((r) => r.course.code)).toEqual(["BCSE302L", "BCSE303L"]);
    expect(rows[0].sameClass.map((m) => m.name)).toEqual(["Arun", "Zara"]);
    expect(rows[1].sameClass).toHaveLength(0);
    expect(rows[1].otherSection[0].theirs.faculty).toBe("Dr. C");
    expect(countClassesTogether(rows)).toBe(1);
  });

  it("puts a peer in only one bucket per course", () => {
    const both = [
      { handle: "AMZ-EEEE-EEEE", name: "E", loaded: true, courses: [course({ classId: "OTHER" }), course({})] },
    ];
    const [row] = sharedClassesByCourse([dbmsMine], both);
    expect(row.sameClass).toHaveLength(1);
    expect(row.otherSection).toHaveLength(0);
  });
});

describe("sharedWithPeer", () => {
  it("splits same-class from same-course", () => {
    const res = sharedWithPeer([dbmsMine, osMine], [course({}), course({ code: "BCSE303L", classId: "OTHER" })]);
    expect(res.sameClass.map((x) => x.mine.code)).toEqual(["BCSE302L"]);
    expect(res.sameCourse.map((x) => x.mine.code)).toEqual(["BCSE303L"]);
  });
});

describe("invite links", () => {
  const handle = "AMZ-7K2P-9RTW";

  it("builds a link on the app origin that round-trips to the handle", () => {
    const link = buildInviteLink(handle, "https://amazecc.example");
    expect(link).toBe("https://amazecc.example/?add=AMZ-7K2P-9RTW");
    expect(handleFromInvite(link)).toBe(handle);
  });

  it("reads a handle from a link with other params, a relative link, or a bare handle", () => {
    expect(handleFromInvite("https://x.example/?utm=wa&add=amz-7k2p-9rtw")).toBe(handle);
    expect(handleFromInvite("/?add=AMZ-7K2P-9RTW")).toBe(handle);
    expect(handleFromInvite("  amz 7k2p 9rtw ")).toBe(handle);
  });

  it("leaves non-invites invalid", () => {
    expect(isValidHandle(handleFromInvite("https://x.example/?foo=bar"))).toBe(false);
    expect(isValidHandle(handleFromInvite("WIFI:S:home;P:secret;;"))).toBe(false);
  });
});
