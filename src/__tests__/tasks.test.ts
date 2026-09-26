import { describe, expect, it, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import {
  isTaskOverdue,
  nextTaskStatus,
} from '../types/tasks';
import {
  normalizeTask,
  createTask,
  updateTask,
  cycleTaskStatus,
  deleteTask,
  getComponentType,
  taskMatchesClass,
  classTaskSummary,
  suggestPomodoros,
  migrateCustomHomework,
} from '../lib/tasksStorage';
import { storage } from '../lib/storage';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? (this.map.get(k) as string) : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

// Node/jsdom in this repo has no usable localStorage (storage.ts swallows the
// failure), so swap in an in-memory implementation for the suite.
beforeAll(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('task status helpers', () => {
  it('cycles pending -> in_progress -> done -> in_progress', () => {
    expect(nextTaskStatus('pending').status).toBe('in_progress');
    const done = nextTaskStatus('in_progress');
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeDefined();
    expect(nextTaskStatus('done').status).toBe('in_progress');
  });

  it('derives overdue only for unfinished past-due tasks', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const future = new Date(Date.now() + 60000).toISOString();
    expect(isTaskOverdue({ dueDate: past, status: 'pending' })).toBe(true);
    expect(isTaskOverdue({ dueDate: past, status: 'done' })).toBe(false);
    expect(isTaskOverdue({ dueDate: future, status: 'pending' })).toBe(false);
    expect(isTaskOverdue({ status: 'pending' })).toBe(false);
  });
});

describe('normalizeTask validation', () => {
  it('requires a title and sane chunk times', () => {
    expect(() => normalizeTask({ title: '  ' })).toThrow();
    expect(() =>
      normalizeTask({ title: 'x', schedule: [{ day: 'MON', start: '10:00', end: '09:00' }] })
    ).toThrow();
    expect(() =>
      normalizeTask({ title: 'x', dueDate: 'not-a-date' })
    ).toThrow();
  });

  it('sorts + dedupes reminders and sanitizes the course code', () => {
    const t = normalizeTask({
      title: 'DA 1',
      courseCode: 'BCSE203E (L)',
      reminders: ['2026-09-03T10:00:00Z', '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z'],
    });
    expect(t.courseCode).toBe('BCSE203E');
    expect(t.reminders).toEqual(['2026-09-01T10:00:00.000Z', '2026-09-03T10:00:00.000Z']);
    expect(t.status).toBe('pending');
  });
});

describe('task CRUD (localStorage-backed)', () => {
  it('creates, updates, cycles and deletes', () => {
    createTask({ title: 'Study CAT', courseCode: 'BMAT201L' });
    let tasks = getTasksSafe();
    expect(tasks).toHaveLength(1);

    updateTask(tasks[0].id, { title: 'Study CAT 1' });
    tasks = getTasksSafe();
    expect(tasks[0].title).toBe('Study CAT 1');

    cycleTaskStatus(tasks[0].id);
    expect(getTasksSafe()[0].status).toBe('in_progress');
    cycleTaskStatus(tasks[0].id);
    const done = getTasksSafe()[0];
    expect(done.status).toBe('done');
    expect(done.completedAt).toBeDefined();

    deleteTask(tasks[0].id);
    expect(getTasksSafe()).toHaveLength(0);
  });

  function getTasksSafe() {
    try {
      return storage.tasks.get() || [];
    } catch {
      return [];
    }
  }
});

describe('course matching', () => {
  it('detects lab vs theory components', () => {
    expect(getComponentType({ courseCode: 'BCSE203E(L)' })).toBe('lab');
    expect(getComponentType({ courseType: 'Embedded Lab' })).toBe('lab');
    expect(getComponentType({ slotName: 'L15+L16' })).toBe('lab');
    expect(getComponentType({ courseCode: 'BMAT201L', courseType: 'Theory Only' })).toBe('theory');
  });

  it('matches tasks to classes with component scoping', () => {
    const theoryTask = { courseCode: 'BCSE203E', component: 'theory' as const };
    const bothTask = { courseCode: 'BCSE203E', component: 'both' as const };
    expect(taskMatchesClass(theoryTask, { courseCode: 'BCSE203E(T)' })).toBe(true);
    expect(taskMatchesClass(theoryTask, { courseCode: 'BCSE203E(L)' })).toBe(false);
    expect(taskMatchesClass(bothTask, { courseCode: 'BCSE203E(L)' })).toBe(true);
    expect(taskMatchesClass(theoryTask, { courseCode: 'OTHER1001' })).toBe(false);
    expect(taskMatchesClass({ courseCode: '', component: 'both' }, { courseCode: 'X' })).toBe(false);
  });

  it('summarizes by kind and respects week-chunk overlap', () => {
    const tasks = [
      { courseCode: 'A', component: 'both', kind: 'test', status: 'pending', schedule: [{ day: 'MON', start: '10:00', end: '11:00' }] },
      { courseCode: 'A', component: 'both', kind: 'homework', status: 'done', schedule: [] },
      { courseCode: 'A', component: 'both', kind: 'digital-assignment', status: 'in_progress', schedule: [] },
    ] as any[];
    const cls = { courseCode: 'A(T)' };
    const s = classTaskSummary(tasks, cls, 'MON', { start: 600, end: 660 });
    expect(s).toEqual({
      total: 2,
      tests: 1,
      das: 1,
      pending: 1,
      // No literalToday, so nothing may claim a "…today" label
      today: { total: 0, tests: 0, das: 0, sessionTotal: 0, dueTotal: 0 },
    });
    // Non-overlapping time window excludes the chunked task
    const s2 = classTaskSummary(tasks, cls, 'MON', { start: 800, end: 860 });
    expect(s2.total).toBe(1);
  });
});

describe('pomodoro suggestion', () => {
  it('fills chunk time with focus/break cycles', () => {
    expect(suggestPomodoros(60)).toEqual({ rounds: 2, focusMin: 25, breakMin: 5 });
    expect(suggestPomodoros(10)).toEqual({ rounds: 1, focusMin: 25, breakMin: 5 });
    expect(suggestPomodoros(120, 50, 10).rounds).toBe(2);
  });
});

describe('customHomework migration', () => {
  it('migrates legacy entries once and never duplicates', () => {
    try {
      storage.customHomework.set([
        { text: 'Old HW', courseName: 'BCSE203E', dueDate: '2026-09-05T00:00:00Z' },
      ] as any);
    } catch {}
    const first = migrateCustomHomework();
    expect(first).toHaveLength(1);
    expect(first[0].kind).toBe('homework');
    expect(first[0].title).toBe('Old HW');
    // Second run is a no-op since tasks now exist
    expect(migrateCustomHomework()).toHaveLength(1);
  });
});
