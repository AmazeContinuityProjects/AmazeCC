let lockCount = 0;
let originalOverflow: string | null = null;

export function acquireBodyScrollLock(): () => void {
  if (typeof document === "undefined") return () => {};

  if (lockCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0 && originalOverflow !== null) {
      document.body.style.overflow = originalOverflow;
      originalOverflow = null;
    }
  };
}
