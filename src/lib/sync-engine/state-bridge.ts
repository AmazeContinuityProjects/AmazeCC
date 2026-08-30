import { getDefaultStore } from "jotai";
import * as dataAtoms from "../../store/dataAtoms";

const store = typeof window !== "undefined" ? getDefaultStore() : null;

/**
 * The ONLY writer of UI state that comes from sync. Components read atoms;
 * they never receive raw fetch results. Also exposes storage persistence via
 * the storage module when an operation needs it.
 */
export const stateBridge = {
  setAtom(atom: unknown, value: unknown): void {
    if (store && atom) store.set(atom as never, value as never);
  },
  getAtom(atom: unknown): unknown {
    return store && atom ? store.get(atom as never) : undefined;
  },
};

export { dataAtoms };
