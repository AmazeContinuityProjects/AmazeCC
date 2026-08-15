import { useState, useEffect } from "react";
import { API_BASE } from "@/components/custom/Main";
import { QBankCourse } from "@/types/qbank.types";

export function useQBankCourses(allGradesData: any, marksData: any) {
  const [courses, setCourses] = useState<QBankCourse[]>([]);
  const [globalCourses, setGlobalCourses] = useState<QBankCourse[]>([]);
  const [globalCoursesLoading, setGlobalCoursesLoading] = useState(false);

  // Fetch global approved courses
  useEffect(() => {
    setGlobalCoursesLoading(true);
    fetch(`${API_BASE}/api/qbank/courses`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setGlobalCourses(d.data);
      })
      .catch(err => console.error("Failed to fetch global courses:", err))
      .finally(() => setGlobalCoursesLoading(false));
  }, []);

  // Extract courses from grades data and marks data
  useEffect(() => {
    const uniqueCourses = new Map<string, string>();
    
    // Add past courses from allGradesData
    if (allGradesData && allGradesData.grades) {
      const gradesArr = Array.isArray(allGradesData.grades)
        ? allGradesData.grades
        : Object.values(allGradesData.grades);

      gradesArr.forEach((sem: any) => {
        const courseList = sem?.grades ?? sem?.courseGrades ?? sem?.courses ?? [];
        const items = Array.isArray(courseList) ? courseList : Object.values(courseList);
        items.forEach((course: any) => {
          const code = course.courseCode ?? course.code;
          const title = course.courseTitle ?? course.title ?? code;
          if (code) uniqueCourses.set(code, title);
        });
      });
    }

    // Add current semester courses from marksData
    if (marksData && marksData.courses && Array.isArray(marksData.courses)) {
      marksData.courses.forEach((course: any) => {
        const code = course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code;
        const title = course?.courseTitle ?? course?.title ?? code;
        if (code && !uniqueCourses.has(code)) {
          uniqueCourses.set(code, title);
        }
      });
    }

    if (uniqueCourses.size > 0) {
      setCourses(
        Array.from(uniqueCourses).map(([code, title]) => ({ code, title }))
      );
    }
  }, [allGradesData, marksData]);

  return { courses, globalCourses, globalCoursesLoading };
}
