import { useState, useEffect } from "react";
import { CourseLock } from "../types";

export const useCourseLocks = () => {
  const [courseLocks, setCourseLocks] = useState<CourseLock[]>([]);
  const [isCourseLockOpen, setIsCourseLockOpen] = useState(false);

  useEffect(() => {
    try {
      const savedCourseLocks = localStorage.getItem("ffcs_courseLocks");
      if (savedCourseLocks) setCourseLocks(JSON.parse(savedCourseLocks));
    } catch (e) {
      console.error("Failed to parse saved course locks", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ffcs_courseLocks", JSON.stringify(courseLocks));
  }, [courseLocks]);

  return {
    courseLocks,
    setCourseLocks,
    isCourseLockOpen,
    setIsCourseLockOpen,
  };
};
