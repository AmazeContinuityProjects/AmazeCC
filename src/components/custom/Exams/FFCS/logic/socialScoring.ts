import { AddedCourse } from "../types";
import { timeToMinutes } from "../utils";

export const getFreeHalfDaysList = (slots: Set<string>, schema: any): string[] => {
  const freeHalfDays: string[] = [];
  const theoryPeriods = (schema.theory as any[]).filter(p => !p.lunch);
  const labPeriods = (schema.lab as any[]).filter(p => !p.lunch);
  
  const DAYS = [
    { id: "monday", label: "MON" },
    { id: "tuesday", label: "TUE" },
    { id: "wednesday", label: "WED" },
    { id: "thursday", label: "THU" },
    { id: "friday", label: "FRI" },
  ];

  DAYS.forEach(day => {
    let morningOccupied = false;
    let eveningOccupied = false;

    theoryPeriods.forEach((p, pIdx) => {
      const tSlot = p.days?.[day.id];
      const lSlot = labPeriods[pIdx]?.days?.[day.id];
      const isMorning = timeToMinutes(p.start as string) < timeToMinutes("2:00 PM");

      let slotOccupied = false;
      if (tSlot && slots.has(tSlot)) slotOccupied = true;
      if (lSlot && slots.has(lSlot)) slotOccupied = true;

      if (slotOccupied) {
        if (isMorning) morningOccupied = true;
        else eveningOccupied = true;
      }
    });

    if (!morningOccupied) freeHalfDays.push(`${day.id}_morning`);
    if (!eveningOccupied) freeHalfDays.push(`${day.id}_evening`);
  });

  return freeHalfDays;
};

export const calculatePairwiseSocialScore = (
  myCourses: AddedCourse[], 
  friendCourses: AddedCourse[], 
  schema: any
): { percentage: number, actualScore: number, maxScore: number } => {
  const mySlots = new Set(myCourses.flatMap(c => c.slots));
  const fSlots = new Set(friendCourses.flatMap(c => c.slots));

  // 1. Mutually Free Slots
  const unionSize = new Set([...mySlots, ...fSlots]).size;
  // Use a hardcoded 60 max slots for simplicity, or deduce from schema
  const mutuallyFreeSlots = 60 - unionSize;
  const maxMutuallyFreeSlots = 60 - fSlots.size;

  // 2. Shared Classes
  let sharedClasses = 0;
  const myCourseMap = new Map<string, string>();
  myCourses.forEach(c => c.slots.forEach(s => myCourseMap.set(s, c.code)));
  
  const fCourseMap = new Map<string, string>();
  friendCourses.forEach(c => c.slots.forEach(s => fCourseMap.set(s, c.code)));

  myCourseMap.forEach((code, slot) => {
    if (fCourseMap.get(slot) === code) {
      sharedClasses++;
    }
  });
  
  const maxSharedClasses = fSlots.size; // friend's total class slots

  // 3. Shared Free Half-Days
  const myFreeHalfDays = getFreeHalfDaysList(mySlots, schema);
  const fFreeHalfDays = getFreeHalfDaysList(fSlots, schema);
  
  let sharedHalfDays = 0;
  const fFreeSet = new Set(fFreeHalfDays);
  myFreeHalfDays.forEach(hd => {
    if (fFreeSet.has(hd)) sharedHalfDays++;
  });

  const maxSharedHalfDays = fFreeHalfDays.length;

  const actualScore = (sharedClasses * 3) + (mutuallyFreeSlots * 1) + (sharedHalfDays * 5);
  const maxScore = (maxSharedClasses * 3) + (maxMutuallyFreeSlots * 1) + (maxSharedHalfDays * 5);

  const percentage = maxScore > 0 ? Math.round((actualScore / maxScore) * 100) : 0;

  return { percentage, actualScore, maxScore };
};
