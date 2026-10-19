"use client";

import { useSyncExternalStore } from "react";

/**
 * Install-prompt plumbing for the PWA.
 *
 * The browser emits `beforeinstallprompt` exactly once per page load and
 * reclaims the default install flow unless `preventDefault()` is called in
 * that handler. This module owns the global capture: the root-mounted
 * `ServiceWorkerRegistrar` calls {@link initPwaInstallListeners} once, and any
 * surface wanting an in-app "Install" button reads state through
 * {@link usePwaInstall} without duplicating listeners.
 */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

const listeners = new Set<() => void>();
function notify() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function isInstallAvailable() {
  return deferredPrompt !== null;
}

/** Globally wires the `beforeinstallprompt` / `appinstalled` listeners exactly once. */
export function initPwaInstallListeners() {
  if (typeof window === "undefined") return () => {};

  const onBeforeInstallPrompt = (event: Event) => {
    // Keep the native banner suppressed until the app chooses to show its
    // own install affordance via promptInstall().
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  };
  const onAppInstalled = () => {
    deferredPrompt = null;
    notify();
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  return () => {
    window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.removeEventListener("appinstalled", onAppInstalled);
  };
}

/**
 * Shows the deferred install prompt. Resolves true when the user accepted.
 * The stored prompt is single-shot by spec — the flag resets after calling.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === "accepted";
}

/** Reactive view over install availability. */
export function usePwaInstall() {
  const canInstall = useSyncExternalStore(subscribe, isInstallAvailable, () => false);
  return { canInstall, promptInstall };
}
