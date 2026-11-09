/**
 * Which of your classes you share with the people you are paired with.
 *
 * Two levels, because they answer different questions:
 *
 * - **Same class**: the VTOP class id matches. Same section, same faculty, same
 *   slots and room — they are sitting in the room with you.
 * - **Same course**: same course code and component (theory vs lab), but a
 *   different class id. Useful for notes and exam prep, and the faculty is
 *   shown because "who is your teacher for it" is the next question.
 *
 * Only `full` pairs carry a course list; a legacy `coarse` pair has none, so it
 * simply never matches and the UI says how many such pairs there are.
 */

import type { SocialCourse } from "./types";

export type CoursePeer = {
  handle: string;
  name: string;
  loaded: boolean;
  courses: SocialCourse[];
};

export type PeerClassMatch = {
  handle: string;
  name: string;
  /** Their entry for the course, for faculty and venue. */
  theirs: SocialCourse;
};

export type SharedCourseRow = {
  /** Your entry for the course. */
  course: SocialCourse;
  /** Paired peers in the exact same class. */
  sameClass: PeerClassMatch[];
  /** Paired peers taking the same course in another section. */
  otherSection: PeerClassMatch[];
};

function norm(v: string | null | undefined): string {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

/** Theory and lab of one course are separate classes; only compare like with like. */
function sameComponent(a: SocialCourse, b: SocialCourse): boolean {
  const ca = norm(a.componentType);
  const cb = norm(b.componentType);
  return !ca || !cb || ca === cb;
}

function isSameClass(a: SocialCourse, b: SocialCourse): boolean {
  const ia = norm(a.classId);
  return Boolean(ia) && ia === norm(b.classId);
}

function isSameCourse(a: SocialCourse, b: SocialCourse): boolean {
  const ca = norm(a.code);
  return Boolean(ca) && ca === norm(b.code) && sameComponent(a, b);
}

/** How one of their courses relates to one of yours, or null when it does not. */
export function classMatch(mine: SocialCourse, theirs: SocialCourse): "same-class" | "same-course" | null {
  if (isSameClass(mine, theirs)) return "same-class";
  if (isSameCourse(mine, theirs)) return "same-course";
  return null;
}

/**
 * One row per course of yours, listing who shares it. Courses nobody shares are
 * left out; rows with people in your actual class come first.
 */
export function sharedClassesByCourse(own: SocialCourse[], peers: CoursePeer[]): SharedCourseRow[] {
  const rows: SharedCourseRow[] = [];
  for (const course of own ?? []) {
    const sameClass: PeerClassMatch[] = [];
    const otherSection: PeerClassMatch[] = [];
    for (const peer of peers ?? []) {
      if (!peer.loaded) continue;
      // Best match per peer: a peer in your class is not also "another section".
      let best: { kind: "same-class" | "same-course"; theirs: SocialCourse } | null = null;
      for (const theirs of peer.courses ?? []) {
        const kind = classMatch(course, theirs);
        if (kind === "same-class") {
          best = { kind, theirs };
          break;
        }
        if (kind === "same-course" && !best) best = { kind, theirs };
      }
      if (!best) continue;
      const match = { handle: peer.handle, name: peer.name, theirs: best.theirs };
      (best.kind === "same-class" ? sameClass : otherSection).push(match);
    }
    if (sameClass.length || otherSection.length) {
      const byName = (a: PeerClassMatch, b: PeerClassMatch) => a.name.localeCompare(b.name);
      rows.push({ course, sameClass: sameClass.sort(byName), otherSection: otherSection.sort(byName) });
    }
  }
  return rows.sort(
    (a, b) =>
      b.sameClass.length - a.sameClass.length ||
      b.otherSection.length - a.otherSection.length ||
      a.course.code.localeCompare(b.course.code),
  );
}

export type PeerSharedClasses = {
  sameClass: { mine: SocialCourse; theirs: SocialCourse }[];
  sameCourse: { mine: SocialCourse; theirs: SocialCourse }[];
};

/** What you share with one peer, for their sheet. */
export function sharedWithPeer(own: SocialCourse[], theirs: SocialCourse[]): PeerSharedClasses {
  const out: PeerSharedClasses = { sameClass: [], sameCourse: [] };
  for (const mine of own ?? []) {
    let best: { kind: "same-class" | "same-course"; theirs: SocialCourse } | null = null;
    for (const t of theirs ?? []) {
      const kind = classMatch(mine, t);
      if (kind === "same-class") {
        best = { kind, theirs: t };
        break;
      }
      if (kind === "same-course" && !best) best = { kind, theirs: t };
    }
    if (best) (best.kind === "same-class" ? out.sameClass : out.sameCourse).push({ mine, theirs: best.theirs });
  }
  return out;
}

/** Number of distinct classes of yours that at least one peer is in with you. */
export function countClassesTogether(rows: SharedCourseRow[]): number {
  return rows.filter((r) => r.sameClass.length > 0).length;
}
