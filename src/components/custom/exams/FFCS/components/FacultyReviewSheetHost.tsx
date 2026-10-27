"use client";

import dynamic from "next/dynamic";
import type { FacultyReviewSheetTarget } from "../hooks/useFacultyReviewSheet";

const FacultyReviewSheet = dynamic(() => import("./FacultyReviewSheet"), { ssr: false });
export type { FacultyReviewSheetTarget };

interface FacultyReviewSheetHostProps {
  target: FacultyReviewSheetTarget | null;
  onClose: () => void;
}

/** Keeps the review-sheet target mapping shared while loading its UI on demand. */
export default function FacultyReviewSheetHost({
  target,
  onClose,
}: FacultyReviewSheetHostProps) {
  return (
    <FacultyReviewSheet
      open={Boolean(target)}
      onClose={onClose}
      facultyName={target?.name || ""}
      employeeId={target?.employeeId}
      courseCode={target?.courseCode}
    />
  );
}
