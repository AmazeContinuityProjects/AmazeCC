import { AddedCourse, ParsedCourse } from "./types";
import timetableSchema from "@/data/campus/chennai.json";

export const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const isCourseFullyAdded = (code: string, requiredTypes: string[], addedCourses: AddedCourse[]) => {
  const addedForCode = addedCourses.filter(c => c.code === code);
  if (addedForCode.length === 0) return false;
  
  const addedTypes = new Set<string>();
  addedForCode.forEach(ac => {
    const types = ac.type.split('+').map(t => t.trim().toUpperCase());
    types.forEach(t => addedTypes.add(t));
  });

  return requiredTypes.every(rt => {
    // If the required type is already in added types, great
    if (addedTypes.has(rt)) {
      // Special check for Embedded courses: ensure they have BOTH Theory and Lab slots added!
      const t = rt.trim().toUpperCase();
      const isEmbedded = t.includes("EMBEDDED") || t.includes("ETH+ELA") || t === "ETH" || t === "ELA";
      
      // Some colleges use "Embedded Theory and Lab" as the type for both the theory row and lab row.
      if (isEmbedded) {
        // Did they add a theory slot?
        const hasTheory = addedForCode.some(ac => ac.slots.some(s => !s.startsWith('L') && s !== 'NIL'));
        // Did they add a lab slot?
        const hasLab = addedForCode.some(ac => ac.slots.some(s => s.startsWith('L')));
        
        // If it's an embedded theory/lab combo, they MUST have both.
        // If they only have one, it's not fully added yet.
        return hasTheory && hasLab;
      }
      
      return true;
    }
    
    // If required is ETH or ELA, but addedTypes has ETH+ELA (which means they added the embedded combined version)
    if ((rt === "ETH" || rt === "ELA") && addedTypes.has("ETH+ELA")) {
      // Double check they have both slots if it's a combined row
      const hasTheory = addedForCode.some(ac => ac.slots.some(s => !s.startsWith('L') && s !== 'NIL'));
      const hasLab = addedForCode.some(ac => ac.slots.some(s => s.startsWith('L')));
      return hasTheory && hasLab;
    }
    
    // If required is TH or LO, but addedTypes has TH+LO
    if ((rt === "TH" || rt === "LO") && addedTypes.has("TH+LO")) return true;

    return false;
  });
};
