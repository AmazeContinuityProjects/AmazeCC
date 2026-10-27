import type { AddedCourse } from "../types";

export type SelectedCourseGroup = AddedCourse & {
  ids: string[];
  batches: string[];
};

/**
 * Merge the halves a student picked for one course (theory + lab, plus any
 * re-registrations) into a single row keyed by course code.
 *
 * Deliberately dependency-free and separate from `SelectedCoursesList`: the
 * planner passes this to the lazily-loaded generator subpage, and importing
 * it from the list component would drag the whole list back into the route's
 * initial bundle.
 */
export function groupSelectedCourses(courseList: AddedCourse[]): SelectedCourseGroup[] {
  const groups = new Map<string, SelectedCourseGroup>();
  courseList.forEach((course) => {
    if (groups.has(course.code)) {
      const group = groups.get(course.code)!;
      group.ids.push(course.id);
      if (!group.faculty.includes(course.faculty)) group.faculty += ` / ${course.faculty}`;
      if (!group.venue.includes(course.venue)) group.venue += ` / ${course.venue}`;
      if (!group.type.includes(course.type)) group.type += ` + ${course.type}`;
      course.slots.forEach((slot) => {
        if (!group.slots.includes(slot)) group.slots.push(slot);
      });
      if (course.batch) {
        course.batch.split(",").map((batch) => batch.trim()).forEach((batch) => {
          if (batch && !group.batches.includes(batch)) group.batches.push(batch);
        });
      }
      group.credits = String(parseFloat(group.credits || "0") + parseFloat(course.credits || "0"));
    } else {
      groups.set(course.code, {
        ...course,
        ids: [course.id],
        batches: course.batch ? course.batch.split(",").map((batch) => batch.trim()).filter(Boolean) : [],
      });
    }
  });
  return Array.from(groups.values());
}
