import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  tasksForClass,
  tasksForClassSession,
  tasksForDay,
  detectChunkOverlaps,
  taskMatchesClass,
  getComponentType,
  classTaskSummary,
  isDueOnDay,
  isSameCalendarDay,
} from "../lib/taskMatch";
import {
  buildReminderQueue,
  isInQuietHours,
  subscribeReminders,
  startReminderScheduler,
  stopReminderScheduler,
} from "../lib/taskReminders";
import {
  previewMoodleImport,
  importMoodleTasks,
} from "../lib/moodleImport";
import { storage } from "../lib/storage";
import type { Task } from "../types/tasks";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

beforeAll(() => {
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("task matching and scheduling", () => {
  const sampleTasks: Task[] = [
    {
      id: "t1",
      title: "Theory Homework",
      kind: "homework",
      status: "pending",
      courseCode: "BCSE203E",
      component: "theory",
      reminders: [],
      schedule: [{ day: "MON", start: "09:00", end: "10:00" }],
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "t2",
      title: "Lab Assignment",
      kind: "digital-assignment",
      status: "pending",
      courseCode: "BCSE203E",
      component: "lab",
      reminders: [],
      schedule: [{ day: "MON", start: "09:30", end: "10:30" }],
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "t3",
      title: "Completed Task",
      kind: "test",
      status: "done",
      courseCode: "BCSE203E",
      component: "both",
      reminders: [],
      schedule: [{ day: "MON", start: "09:00", end: "10:00" }],
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    },
  ];

  it("filters tasks by class component and time overlap", () => {
    const theoryCls = { courseCode: "BCSE203E(T)", courseType: "Theory" };
    const matched = tasksForClass(sampleTasks, theoryCls, "MON", { start: 540, end: 600 });
    // t1 matches, t2 is lab only, t3 is done
    expect(matched.map((t) => t.id)).toEqual(["t1"]);
  });

  it("finds scheduled tasks for a given day", () => {
    expect(tasksForDay("MON", sampleTasks)).toHaveLength(2); // t1 and t2
    expect(tasksForDay("TUE", sampleTasks)).toHaveLength(0);
  });

  it("detects chunk collisions across tasks", () => {
    // t1 (09:00 - 10:00) and t2 (09:30 - 10:30) overlap on MON
    const overlaps = detectChunkOverlaps(sampleTasks);
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].taskA.id).toBe("t1");
    expect(overlaps[0].taskB.id).toBe("t2");
  });
});

describe("session-scoped home labels", () => {
  const cls = { courseCode: "BCSE203E(T)", courseType: "Theory" };
  const monSession = { start: 540, end: 600 }; // 09:00 - 10:00
  // A Monday so day-code + date stay independent of the real clock
  const monday = new Date(2026, 8, 28);

  const mkTask = (over: Partial<Task>): Task => ({
    id: "x",
    title: "T",
    kind: "homework",
    status: "pending",
    courseCode: "BCSE203E",
    component: "both",
    reminders: [],
    schedule: [],
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    ...over,
  });

  it("claims 'today' only for tasks chunked to this exact session", () => {
    const tasks = [
      mkTask({ id: "t-mon", kind: "test", schedule: [{ day: "MON", start: "09:00", end: "10:00" }] }),
      mkTask({ id: "t-wed", kind: "test", schedule: [{ day: "WED", start: "09:00", end: "10:00" }] }),
    ];
    const s = classTaskSummary(tasks, cls, "MON", monSession, {
      dayDate: monday,
      literalToday: true,
    });
    expect(s.total).toBe(1); // only the MON task belongs to this session
    expect(s.today.total).toBe(1);
    expect(s.today.tests).toBe(1);
    expect(s.today.sessionTotal).toBe(1);
    expect(s.today.dueTotal).toBe(0);
  });

  it("stays generic when the viewed day is not the real current date", () => {
    const tasks = [
      mkTask({ id: "t-mon", kind: "test", schedule: [{ day: "MON", start: "09:00", end: "10:00" }] }),
    ];
    const s = classTaskSummary(tasks, cls, "MON", monSession, {
      dayDate: monday,
      literalToday: false,
    });
    expect(s.total).toBe(1);
    expect(s.today).toEqual({ total: 0, tests: 0, das: 0, sessionTotal: 0, dueTotal: 0 });
  });

  it("counts an unscheduled task as today when it is only due that day", () => {
    const tasks = [
      mkTask({
        id: "t-due",
        kind: "digital-assignment",
        dueDate: new Date(2026, 8, 28, 23, 59).toISOString(),
      }),
      mkTask({
        id: "t-other",
        kind: "digital-assignment",
        dueDate: new Date(2026, 8, 30, 9, 0).toISOString(),
      }),
    ];
    const s = classTaskSummary(tasks, cls, "MON", monSession, {
      dayDate: monday,
      literalToday: true,
    });
    expect(s.total).toBe(2);
    expect(s.today.total).toBe(1);
    expect(s.today.das).toBe(1);
    expect(s.today.dueTotal).toBe(1);
    expect(s.today.sessionTotal).toBe(0);
  });

  it("prefers a test over a digital assignment in the today breakdown", () => {
    const tasks = [
      mkTask({ id: "t-da", kind: "digital-assignment", schedule: [{ day: "MON", start: "09:30", end: "10:30" }] }),
      mkTask({ id: "t-test", kind: "test", schedule: [{ day: "MON", start: "09:00", end: "10:00" }] }),
    ];
    const s = classTaskSummary(tasks, cls, "MON", monSession, {
      dayDate: monday,
      literalToday: true,
    });
    expect(s.today.tests).toBe(1);
    expect(s.today.das).toBe(1);
    // Badge picks the test branch first
    expect(s.today.tests > 0).toBe(true);
  });

  it("tasksForClassSession only returns chunk matches, never unscheduled tasks", () => {
    const tasks = [
      mkTask({ id: "t-mon", schedule: [{ day: "MON", start: "09:00", end: "10:00" }] }),
      mkTask({ id: "t-none" }),
      mkTask({ id: "t-late", schedule: [{ day: "MON", start: "15:00", end: "16:00" }] }),
    ];
    expect(tasksForClassSession(tasks, cls, "MON", monSession).map((t) => t.id)).toEqual([
      "t-mon",
    ]);
  });

  it("isDueOnDay / isSameCalendarDay handle boundaries", () => {
    const day = new Date(2026, 8, 28, 0, 0);
    expect(isDueOnDay(new Date(2026, 8, 28, 23, 59).toISOString(), day)).toBe(true);
    expect(isDueOnDay(new Date(2026, 8, 29, 0, 1).toISOString(), day)).toBe(false);
    expect(isDueOnDay("not-a-date", day)).toBe(false);
    expect(isDueOnDay(undefined, day)).toBe(false);
    // cross-month / cross-year
    expect(isDueOnDay(new Date(2026, 7, 31).toISOString(), day)).toBe(false);
    expect(isSameCalendarDay(new Date(2025, 8, 28), day)).toBe(false);
  });
});

describe("reminders and quiet hours", () => {
  it("evaluates overnight quiet hours correctly", () => {
    // 23:30 (11:30 PM) is in quiet hours (22:00 to 07:00)
    const night = new Date(2026, 8, 26, 23, 30).getTime();
    expect(isInQuietHours(night, "22:00", "07:00")).toBe(true);

    // 03:00 (3 AM) is in quiet hours
    const early = new Date(2026, 8, 26, 3, 0).getTime();
    expect(isInQuietHours(early, "22:00", "07:00")).toBe(true);

    // 14:00 (2 PM) is NOT in quiet hours
    const day = new Date(2026, 8, 26, 14, 0).getTime();
    expect(isInQuietHours(day, "22:00", "07:00")).toBe(false);
  });

  it("builds queue filtering out past reminders and done tasks", () => {
    const futureIso = new Date(Date.now() + 3600000).toISOString();
    const pastIso = new Date(Date.now() - 3600000).toISOString();

    const tasks: Task[] = [
      {
        id: "t-rem",
        title: "Upcoming Test",
        kind: "test",
        status: "pending",
        courseCode: "MAT101",
        component: "both",
        reminders: [pastIso, futureIso],
        schedule: [],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
    ];

    const q = buildReminderQueue(tasks, { pushQuietHoursEnabled: false });
    expect(q).toHaveLength(1);
    expect(q[0].taskId).toBe("t-rem");
  });

  it("drops due-lead reminders that land inside quiet hours", () => {
    // 06:00 is inside the default 22:00-07:00 quiet window
    const dueInsideQuiet = new Date();
    dueInsideQuiet.setHours(6, 0, 0, 0);
    const task: Task = {
      id: "t-quiet",
      title: "Early Submission",
      kind: "homework",
      status: "pending",
      courseCode: "MAT101",
      component: "both",
      reminders: [],
      schedule: [],
      dueDate: new Date(dueInsideQuiet.getTime() + 30 * 60 * 1000).toISOString(),
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
    };
    const now = new Date();
    now.setHours(5, 0, 0, 0);
    expect(
      buildReminderQueue([task], { pushQuietHoursEnabled: true }, now.getTime())
    ).toHaveLength(0);
    expect(
      buildReminderQueue(
        [task],
        { pushQuietHoursEnabled: false },
        now.getTime()
      )
    ).toHaveLength(1);
  });

  it("notifies subscribers when a reminder fires and can be stopped", () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const unsubscribe = subscribeReminders((r) => seen.push(r.taskTitle));

    const soon = new Date(Date.now() + 1000).toISOString();
    const tasks: Task[] = [
      {
        id: "t-fire",
        title: "Ring Now",
        kind: "reminder",
        status: "pending",
        courseCode: "",
        component: "both",
        reminders: [soon],
        schedule: [],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
    ];

    startReminderScheduler(tasks, {});
    vi.advanceTimersByTime(1500);
    expect(seen).toEqual(["Ring Now"]);

    // Stopping clears the pending arm so nothing fires afterwards
    const later = new Date(Date.now() + 60_000).toISOString();
    startReminderScheduler([{ ...tasks[0], id: "t-fire2", reminders: [later] }], {});
    stopReminderScheduler();
    vi.advanceTimersByTime(120_000);
    expect(seen).toEqual(["Ring Now"]);

    unsubscribe();
    vi.useRealTimers();
  });
});

describe("moodle one-way import", () => {
  it("parses assignment names and dedupes on moodleUrl", () => {
    const rawAssignments = [
      {
        name: "BCSE203E/Theory/DA 1",
        due: "2026-10-15T23:59:00Z",
        url: "https://moodle.vit.ac.in/mod/assign/view.php?id=101",
      },
      {
        name: "BCSE203E/Theory/DA 2",
        due: "2026-10-20T23:59:00Z",
        url: "https://moodle.vit.ac.in/mod/assign/view.php?id=102",
        done: true, // Should be ignored
      },
    ];

    const existing: Task[] = [
      {
        id: "existing-1",
        title: "Old DA",
        kind: "digital-assignment",
        status: "pending",
        courseCode: "BCSE203E",
        component: "both",
        moodleUrl: "https://moodle.vit.ac.in/mod/assign/view.php?id=101",
        reminders: [],
        schedule: [],
        createdAt: "2026-09-01T00:00:00Z",
        updatedAt: "2026-09-01T00:00:00Z",
      },
    ];

    const previews = previewMoodleImport(rawAssignments, existing);
    expect(previews).toHaveLength(1); // Only ID 101 because ID 102 is done: true
    expect(previews[0].alreadyImported).toBe(true);
    expect(previews[0].courseCode).toBe("BCSE203E");
    expect(previews[0].title).toBe("DA 1");

    // Importing when already imported should not create duplicate
    const result = importMoodleTasks(previews);
    expect(result).toHaveLength(0);
  });
});
