import { useCallback, useSyncExternalStore } from "react";
import { syncEngine } from "./index";
import { progressBus } from "./progress-bus";
import type { ProgressEvent } from "./types";

/**
 * The only public surface components should use for sync. Reads of data go
 * through atoms (set by the engine); this hook exposes triggers + status.
 */
export function useSync(name?: string) {
  const subscribe = useCallback((cb: () => void) => progressBus.subscribe(() => cb()), []);
  const status = useSyncExternalStore(subscribe, () => progressBus.getSnapshot());

  const sync = useCallback(
    (opName?: string, args?: Record<string, unknown>) =>
      syncEngine.sync(opName ?? name ?? "", args),
    [name],
  );

  return {
    status: status as ProgressEvent,
    sync,
    syncAll: syncEngine.syncAll.bind(syncEngine),
    login: syncEngine.login.bind(syncEngine),
    logout: syncEngine.logout.bind(syncEngine),
    editCredentials: syncEngine.editCredentials.bind(syncEngine),
    subscribe: syncEngine.subscribe.bind(syncEngine),
  };
}
