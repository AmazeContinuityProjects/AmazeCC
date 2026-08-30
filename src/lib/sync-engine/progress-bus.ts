import type { ProgressEvent } from "./types";

type Listener = (e: ProgressEvent) => void;

let lastEvent: ProgressEvent = { op: "*", phase: "idle" };
let version = 0;

class ProgressBus {
  private listeners = new Set<Listener>();

  subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  emit(e: ProgressEvent): void {
    lastEvent = e;
    version++;
    this.listeners.forEach((l) => l(e));
  }

  getSnapshot(): ProgressEvent {
    return lastEvent;
  }

  getVersion(): number {
    return version;
  }
}

export const progressBus = new ProgressBus();
