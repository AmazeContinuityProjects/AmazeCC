"use client";

import { useCallback, useState } from "react";

export interface FacultyReviewSheetTarget {
  name: string;
  employeeId?: string;
  courseCode?: string;
}

/** Share the target/close lifecycle used by planner-owned faculty review sheets. */
export function useFacultyReviewSheet() {
  const [target, setTarget] = useState<FacultyReviewSheetTarget | null>(null);

  const open = useCallback((nextTarget: FacultyReviewSheetTarget) => {
    setTarget(nextTarget);
  }, []);

  const close = useCallback(() => {
    setTarget(null);
  }, []);

  return { target, open, close };
}
