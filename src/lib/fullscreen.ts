/**
 * Native fullscreen with the WebKit prefixes, extracted from
 * FFCSGuidedSelector: the guided flow toggles document fullscreen on entering
 * its focus modes and needs the prefixed fallbacks on Safari. Pure DOM — no
 * React, no app state — so it sits in lib where anything can use it.
 */

export function requestNativeFullscreen(element?: HTMLElement): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  const target = element || document.documentElement;
  if (!target) return Promise.resolve();

  try {
    if (typeof target.requestFullscreen === "function") {
      return target.requestFullscreen().catch(() => {});
    }
    const elWithWebkit = target as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      webkitRequestFullScreen?: () => Promise<void> | void;
    };
    if (typeof elWithWebkit.webkitRequestFullscreen === "function") {
      return Promise.resolve(elWithWebkit.webkitRequestFullscreen());
    }
    if (typeof elWithWebkit.webkitRequestFullScreen === "function") {
      return Promise.resolve(elWithWebkit.webkitRequestFullScreen());
    }
  } catch {
    // Ignore fullscreen request rejection
  }
  return Promise.resolve();
}

export function exitNativeFullscreen(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  try {
    const docWithWebkit = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      webkitCancelFullScreen?: () => Promise<void> | void;
      fullscreenElement?: Element | null;
      webkitFullscreenElement?: Element | null;
    };

    const isCurrentlyFullscreen = Boolean(document.fullscreenElement || docWithWebkit.webkitFullscreenElement);

    if (!isCurrentlyFullscreen) return Promise.resolve();

    if (typeof document.exitFullscreen === "function") {
      return document.exitFullscreen().catch(() => {});
    }
    if (typeof docWithWebkit.webkitExitFullscreen === "function") {
      return Promise.resolve(docWithWebkit.webkitExitFullscreen());
    }
    if (typeof docWithWebkit.webkitCancelFullScreen === "function") {
      return Promise.resolve(docWithWebkit.webkitCancelFullScreen());
    }
  } catch {
    // Ignore exit fullscreen rejection
  }
  return Promise.resolve();
}
