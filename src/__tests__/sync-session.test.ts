import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  openSyncSession,
  ensureSyncSession,
  openOfflineSyncSession,
  appendSyncLine,
  setSyncProgress,
  bumpSyncProgress,
  closeSyncSession,
  dismissSyncSession,
  isSyncSessionOpen,
  useSyncSession,
  formatSessionMessage,
  handleEngineProgressEvent,
  getSyncSessionSnapshot,
} from '../lib/sync-engine/sync-session';

function resetToClosedBaseline() {
  // Close immediately, then clear the dismissed marker with a fresh open+close
  // so every test starts from a pristine closed session.
  closeSyncSession(0);
  vi.runAllTimers();
  openSyncSession('baseline');
  dismissSyncSession();
  openSyncSession('baseline');
  closeSyncSession(0);
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetToClosedBaseline();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
});

describe('sync session lifecycle', () => {
  it('opens with a visible title line and zero progress', () => {
    openSyncSession('VTOP Sync');
    const s = getSyncSessionSnapshot();
    expect(s.open).toBe(true);
    expect(s.progress).toBe(0);
    expect(s.lines.length).toBe(1);
    expect(s.lines[0].status).toBe('loading');
    expect(formatSessionMessage(s.lines)).toContain('VTOP Sync');
  });

  it('appends lines and clamps progress to 0-100', () => {
    openSyncSession('VTOP Sync');
    appendSyncLine('Attendance & Marks fetched', 'success');
    setSyncProgress(25);
    bumpSyncProgress(200);
    const s = getSyncSessionSnapshot();
    expect(s.lines.map((l) => l.text)).toContain('Attendance & Marks fetched');
    expect(s.progress).toBe(100);
    setSyncProgress(-50);
    expect(getSyncSessionSnapshot().progress).toBe(0);
  });

  it('holds the final log visible, then closes', () => {
    openSyncSession('VTOP Sync');
    appendSyncLine('Core data loaded successfully', 'success');
    closeSyncSession(2500);
    expect(isSyncSessionOpen()).toBe(true);
    vi.advanceTimersByTime(2499);
    expect(isSyncSessionOpen()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isSyncSessionOpen()).toBe(false);
    // Final log survives the close for readers holding a snapshot.
    expect(getSyncSessionSnapshot().lines.length).toBeGreaterThan(0);
  });

  it('dismiss mid-flight suppresses re-opens from the same run', () => {
    openSyncSession('VTOP Sync');
    appendSyncLine('Fetching Attendance & Marks…', 'loading');
    dismissSyncSession();
    expect(isSyncSessionOpen()).toBe(false);
    // A late engine event from the dismissed run must not pop the sheet back.
    ensureSyncSession('VTOP Sync');
    expect(isSyncSessionOpen()).toBe(false);
    appendSyncLine('Attendance & Marks fetched', 'success');
    expect(getSyncSessionSnapshot().lines.map((l) => l.text)).not.toContain(
      'Attendance & Marks fetched'
    );
    // A brand-new run opens normally again.
    openSyncSession('VTOP Sync');
    expect(isSyncSessionOpen()).toBe(true);
  });

  it('appends are ignored while closed', () => {
    const before = getSyncSessionSnapshot().lines.length;
    appendSyncLine('Stray line', 'info');
    expect(getSyncSessionSnapshot().lines.length).toBe(before);
  });

  it('tracks outcome: null while running, success or error on close', () => {
    openSyncSession('VTOP Sync');
    expect(getSyncSessionSnapshot().outcome).toBe(null);
    closeSyncSession(2500);
    expect(getSyncSessionSnapshot().outcome).toBe('success');
    vi.runAllTimers();
    openSyncSession('VTOP Sync');
    closeSyncSession(4000, 'error');
    expect(getSyncSessionSnapshot().outcome).toBe('error');
    vi.runAllTimers();
    // Fresh runs reset the outcome.
    openSyncSession('VTOP Sync');
    expect(getSyncSessionSnapshot().outcome).toBe(null);
  });
});

describe('offline notice', () => {
  it('opens the sheet flagged as a notice rather than a run', () => {
    openOfflineSyncSession();
    const s = getSyncSessionSnapshot();
    expect(s.open).toBe(true);
    expect(s.notice).toBe('offline');
    // No run finished, so the sheet must not claim success.
    expect(s.outcome).toBe(null);
  });

  it('clears the notice once a real run starts', () => {
    openOfflineSyncSession();
    openSyncSession('VTOP Sync');
    expect(getSyncSessionSnapshot().notice).toBe(null);
  });

  it('dismisses like any other session, without a hold timer', () => {
    openOfflineSyncSession();
    dismissSyncSession();
    expect(isSyncSessionOpen()).toBe(false);
  });
});

describe('engine progress feed', () => {
  it('logs start and done per op with progress bumps', () => {
    openSyncSession('VTOP Sync');
    handleEngineProgressEvent({ op: 'attendanceMarks', phase: 'start' });
    handleEngineProgressEvent({ op: 'attendanceMarks', phase: 'done' });
    const texts = getSyncSessionSnapshot().lines.map((l) => l.text);
    expect(texts).toContain('Fetching Attendance & Marks…');
    expect(texts).toContain('Attendance & Marks fetched');
    expect(getSyncSessionSnapshot().progress).toBe(25);
  });

  it('logs per-request child ops inside core', () => {
    openSyncSession('VTOP Sync');
    for (const op of ['grades', 'schedule', 'hostel', 'calendar', 'all-grades', 'profile-images']) {
      handleEngineProgressEvent({ op, phase: 'done' });
    }
    const texts = getSyncSessionSnapshot().lines.map((l) => l.text);
    expect(texts).toContain('Grades fetched');
    expect(texts).toContain('Exam schedule fetched');
    expect(texts).toContain('Hostel details fetched');
    expect(texts).toContain('Academic calendar fetched');
    expect(texts).toContain('All grades history fetched');
    expect(texts).toContain('Profile images fetched');
  });

  it('logs failures with the engine error message', () => {
    openSyncSession('VTOP Sync');
    handleEngineProgressEvent({
      op: 'core',
      phase: 'error',
      error: { kind: 'transient', message: 'HTTP 500', retryAfterMs: 1000 },
    });
    const lines = getSyncSessionSnapshot().lines;
    const last = lines[lines.length - 1];
    expect(last.status).toBe('error');
    expect(last.text).toContain('Core data bundle failed');
    expect(last.text).toContain('HTTP 500');
  });

  it('formats lines back into the legacy message string', () => {
    const msg = formatSessionMessage([
      { text: 'VTOP Sync…', status: 'loading' },
      { text: 'Attendance & Marks fetched', status: 'success' },
      { text: 'Core data failed — boom', status: 'error' },
    ]);
    expect(msg).toBe('⏳ VTOP Sync…\n✅ Attendance & Marks fetched\n❌ Core data failed — boom');
  });

  it('exposes a live snapshot reader for the hook', () => {
    expect(typeof useSyncSession).toBe('function');
    openSyncSession('VTOP Sync');
    appendSyncLine('Attendance & Marks fetched', 'success');
    expect(getSyncSessionSnapshot().lines.length).toBe(2);
  });
});

describe('routing visibility in the log', () => {
  it('names the server that answered, and the endpoint it was for', async () => {
    const { emitUniccLogEvent } = await import('../lib/unicc-fallback');
    openSyncSession('VTOP Sync');

    emitUniccLogEvent({ type: 'unicc_served', path: 'attendance' });
    emitUniccLogEvent({ type: 'unicc_served', path: 'all-grades' });

    const texts = getSyncSessionSnapshot().lines.map((l) => l.text);
    // The op lines already say what was fetched; this is the part that says who.
    expect(texts).toContain('attendance served by UniCC API');
    expect(texts).toContain('all-grades served by UniCC API');
  });

  it('says so when AmazeCC failed and UniCC took over', async () => {
    const { emitUniccLogEvent } = await import('../lib/unicc-fallback');
    openSyncSession('VTOP Sync');

    emitUniccLogEvent({ type: 'fell_back_to_unicc', path: 'grades' });
    emitUniccLogEvent({ type: 'unicc_served', path: 'grades' });

    const lines = getSyncSessionSnapshot().lines;
    expect(lines.some((l) => l.text === 'AmazeCC API failed — falling back to UniCC for grades')).toBe(true);
    expect(lines.some((l) => l.text === 'grades served by UniCC API')).toBe(true);
  });

  it('says so when UniCC was asked and could not answer', async () => {
    const { emitUniccLogEvent } = await import('../lib/unicc-fallback');
    openSyncSession('VTOP Sync');

    emitUniccLogEvent({ type: 'unicc_unavailable', path: 'hostel' });

    expect(getSyncSessionSnapshot().lines.some((l) =>
      l.text === 'UniCC API could not answer hostel details — using AmazeCC API'
    )).toBe(true);
  });

  it('uses readable names for the endpoints a student would recognise', async () => {
    const { emitUniccLogEvent } = await import('../lib/unicc-fallback');
    openSyncSession('VTOP Sync');

    emitUniccLogEvent({ type: 'unicc_served', path: 'login' });
    emitUniccLogEvent({ type: 'unicc_served', path: 'lms-data' });

    const texts = getSyncSessionSnapshot().lines.map((l) => l.text);
    // "login" and "lms-data" are internal names; the log is not an API reference.
    expect(texts).toContain('sign-in served by UniCC API');
    expect(texts).toContain('Moodle data served by UniCC API');
  });

  it('records nothing when no session is open', async () => {
    const { emitUniccLogEvent } = await import('../lib/unicc-fallback');
    dismissSyncSession();
    closeSyncSession(0);
    vi.runAllTimers();

    emitUniccLogEvent({ type: 'unicc_served', path: 'attendance' });

    // Requests also fire outside a visible run (the boot health check, a
    // background reload); none of that should resurrect a closed sheet.
    expect(isSyncSessionOpen()).toBe(false);
  });
});

describe('assertApiSuccess', () => {
  it('passes through healthy payloads untouched', async () => {
    const { assertApiSuccess } = await import('../lib/sync-engine/errors');
    expect(() => assertApiSuccess({ attendance: [] }, 'Attendance')).not.toThrow();
    expect(() => assertApiSuccess([1, 2, 3], 'Moodle data')).not.toThrow();
    expect(() => assertApiSuccess({ success: true }, 'Grades')).not.toThrow();
    expect(() => assertApiSuccess(null, 'Grades')).not.toThrow();
    expect(() => assertApiSuccess(undefined, 'Grades')).not.toThrow();
  });

  it('throws a labelled error on success:false payloads', async () => {
    const { assertApiSuccess } = await import('../lib/sync-engine/errors');
    expect(() => assertApiSuccess({ success: false, message: 'VTOP busy' }, 'Grades')).toThrow(
      'Grades failed: VTOP busy'
    );
    expect(() => assertApiSuccess({ success: false, error: 'boom' }, 'Grades')).toThrow(
      'Grades failed: boom'
    );
    expect(() => assertApiSuccess({ success: false }, 'Grades')).toThrow(
      'Grades failed: server returned an error'
    );
  });
});
