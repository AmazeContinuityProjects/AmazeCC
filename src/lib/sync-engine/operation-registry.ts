import type { AuthDomain, Ids } from "./types";
import { request } from "./request-layer";
import { stateBridge } from "./state-bridge";
import { progressBus } from "./progress-bus";

export interface OpCtx {
  request: typeof request;
  ids: Ids;
  emit: (e: import("./types").ProgressEvent) => void;
  bridge: typeof stateBridge;
}

export interface SyncOp {
  name: string;
  auth: AuthDomain | "none";
  run: (ctx: OpCtx, args?: Record<string, unknown>) => Promise<unknown>;
  critical?: boolean;
  dependsOn?: string[];
}

const ops = new Map<string, SyncOp>();

export function registerOp(op: SyncOp): void {
  ops.set(op.name, op);
}

export function getOp(name: string): SyncOp | undefined {
  return ops.get(name);
}

export function allOps(): SyncOp[] {
  return [...ops.values()];
}

export function makeCtx(ids: Ids) {
  return {
    request,
    ids,
    emit: (e: import("./types").ProgressEvent) => progressBus.emit(e),
    bridge: stateBridge,
  } as OpCtx;
}
