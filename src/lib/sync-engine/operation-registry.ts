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

export type SyncOpCategory = "academics" | "stay" | "campus" | "profile" | "social";

export type SyncOpCost = "light" | "medium" | "heavy";

export interface SyncOpMeta {
  /** Human label for logs, pickers and the editor. */
  label: string;
  /** One-line explanation shown in the mode editor. */
  description: string;
  category: SyncOpCategory;
  /** Relative network cost, used for low-data warnings. */
  cost: SyncOpCost;
  needsSemester?: boolean;
}

export interface SyncOp {
  name: string;
  auth: AuthDomain | "none";
  run: (ctx: OpCtx, args?: Record<string, unknown>) => Promise<unknown>;
  critical?: boolean;
  dependsOn?: string[];
  meta?: SyncOpMeta;
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

/** Metadata for one op, if the op registered any. */
export function getOpMeta(name: string): SyncOpMeta | undefined {
  return ops.get(name)?.meta;
}

/** Every registered op with its metadata (label falls back to the op name). */
export function listOpMeta(): (SyncOpMeta & { name: string; auth: AuthDomain | "none" })[] {
  return [...ops.values()].map((op) => ({
    name: op.name,
    auth: op.auth,
    label: op.meta?.label ?? op.name,
    description: op.meta?.description ?? "",
    category: op.meta?.category ?? "profile",
    cost: op.meta?.cost ?? "medium",
    ...(op.meta?.needsSemester ? { needsSemester: true as const } : {}),
  }));
}

export function makeCtx(ids: Ids) {
  return {
    request,
    ids,
    emit: (e: import("./types").ProgressEvent) => progressBus.emit(e),
    bridge: stateBridge,
  } as OpCtx;
}
