import { credentialManager } from "./credential-manager";
import { progressBus } from "./progress-bus";
import { makeCtx, getOp } from "./operation-registry";
import { toEngineError } from "./errors";
import { storage } from "../storage";
import type { Ids, VtopCreds, ProgressEvent } from "./types";

export { apiRequest as api } from "./request-layer";

export interface SyncAllOptions {
  semesterId: string;
  calendarType?: string;
  isHosteller?: boolean;
  settings?: Record<string, unknown>;
  demoMode?: boolean;
}

const BACKGROUND_OPS = ["pastAttendance", "fresher", "buses", "transport", "events", "bulk", "lms"];

class SyncEngine {
  private ids: Ids | null = null;

  private ensureIds(): Ids {
    if (!this.ids) throw new Error("SyncEngine: not logged in");
    return this.ids;
  }

  async login(ids: Ids, demoMode = false): Promise<VtopCreds> {
    this.ids = ids;
    return credentialManager.loginVtop(ids, { demoMode });
  }

  async loginEventHub(ids: Ids, demoMode = false): Promise<string> {
    this.ids = ids;
    return credentialManager.loginEventHub(ids, { demoMode });
  }

  async editCredentials(next: Ids): Promise<void> {
    this.ids = next;
    return credentialManager.editCredentials(next);
  }

  logout(): void {
    credentialManager.logout();
    this.ids = null;
  }

  getVtopCreds(): VtopCreds {
    const c = credentialManager.getStoredVtop();
    if (!c || !c.cookies) throw new Error("SyncEngine: not logged in");
    return c;
  }

  async sync<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const op = getOp(name);
    if (!op) throw new Error(`Unknown sync op: ${name}`);
    const ctx = makeCtx(this.ensureIds());
    progressBus.emit({ op: name, phase: "start" });
    try {
      const result = (await op.run(ctx, args)) as T;
      progressBus.emit({ op: name, phase: "done" });
      return result;
    } catch (e) {
      progressBus.emit({ op: name, phase: "error", error: toEngineError(e) });
      throw e;
    }
  }

  async syncAll(opts: SyncAllOptions): Promise<void> {
    this.ensureIds();
    await this.sync("attendanceMarks", { semesterId: opts.semesterId });
    await this.sync("core", {
      semesterId: opts.semesterId,
      calendarType: opts.calendarType,
      isHosteller: opts.isHosteller,
    });
    await this.sync("studentProfile");
    const allGradesRes = storage.allGrades.get();
    for (const name of BACKGROUND_OPS) {
      this.sync(name, {
        semesterId: opts.semesterId,
        allGradesRes,
        settings: opts.settings,
        demoMode: opts.demoMode,
      }).catch(() => {});
    }
  }

  subscribe(cb: (e: ProgressEvent) => void): () => void {
    return progressBus.subscribe(cb);
  }
}

import "./operations";

export const syncEngine = new SyncEngine();

export function clearEventHubSession(): void {
  credentialManager.clearEventHub();
}

export function loginToEventHub(ids: Ids, demoMode = false): Promise<string> {
  return syncEngine.loginEventHub(ids, demoMode);
}

export function getVtopCreds(): VtopCreds {
  return syncEngine.getVtopCreds();
}
