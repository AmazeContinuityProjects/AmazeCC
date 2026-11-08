"use client";

import { useSyncExternalStore } from "react";

/**
 * One shared clock for the whole app, ticked every 30 seconds.
 *
 * The home screen used to hold `currentTime` as component state, so its 30s
 * ticker re-rendered the entire 2,300-line tree — every tap that landed near a
 * tick queued behind that render (mobile INP). Components now subscribe to this
 * store instead and only re-render themselves: the snapshot each hook returns
 * decides how often that is (full Date, hour, or calendar-day key), so the
 * interval can tick without waking anyone who doesn't care.
 *
 * The interval starts with the first subscriber and stops with the last, so an
 * app that never renders a time-dependent leaf never pays for the timer. All
 * browser access happens inside `subscribe`/`getSnapshot`, never at module
 * scope, so server renders only ever see `SERVER_SNAPSHOT`.
 */
const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = new Date();
let current = new Date();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  current = new Date();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    current = new Date();
    timer = setInterval(tick, 30_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const dayKeyOf = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** The live clock. Re-renders the caller every 30s — for progress bars, countdowns, live badges. */
export function useNow(): Date {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => SERVER_SNAPSHOT,
  );
}

/** Hour of day. Re-renders the caller only when the hour actually changes — greetings. */
export function useNowHour(): number {
  return useSyncExternalStore(
    subscribe,
    () => current.getHours(),
    () => SERVER_SNAPSHOT.getHours(),
  );
}

/** Minute timestamp. Re-renders the caller only when the minute changes. */
export function useNowMinute(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(current.getTime() / 60_000),
    () => Math.floor(SERVER_SNAPSHOT.getTime() / 60_000),
  );
}

/** `Y-M-D` key. Re-renders the caller only at midnight — anything gated on "today". */
export function useDayKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => dayKeyOf(current),
    () => dayKeyOf(SERVER_SNAPSHOT),
  );
}
