import { AddedCourse } from "../types";
import { timeToMinutes } from "../utils";

export const calculateTimetableMetrics = (courses: AddedCourse[], schema: any) => {
  const DAYS = [
    { id: "monday", label: "MON" },
    { id: "tuesday", label: "TUE" },
    { id: "wednesday", label: "WED" },
    { id: "thursday", label: "THU" },
    { id: "friday", label: "FRI" },
  ];

  let freeHalfDays = 0;
  let totalGapMinutes = 0;
  let isFridayFree = true;
  let isMondayFree = true;
  let buildingDashes = 0;
  
  const gapsPerDay: Record<string, number> = {};
  const dashDetails: { fromClass: string; toClass: string; fromTime: string; toTime: string; day: string; fromBlock: string; toBlock: string }[] = [];
  const gapDetails: { day: string; startMin: number; endMin: number; durationMins: number; fromClass?: string; toClass?: string; fromTime?: string; toTime?: string }[] = [];

  const mySlots = new Set(courses.flatMap(c => c.slots));
  const theoryPeriods = (schema.theory as any[]).filter(p => !p.lunch);
  const labPeriods = (schema.lab as any[]).filter(p => !p.lunch);

  DAYS.forEach(day => {
    let morningOccupied = false;
    let eveningOccupied = false;
    
    type DailyClass = { startMins: number, endMins: number, venue: string, title: string, code: string, startTime: string, endTime: string };
    const dailyClasses: DailyClass[] = [];

    theoryPeriods.forEach((p, pIdx) => {
      const tSlot = p.days?.[day.id];
      const lSlot = labPeriods[pIdx]?.days?.[day.id];
      const isMorning = timeToMinutes(p.start as string) < timeToMinutes("2:00 PM");
      
      let slotOccupied = false;
      let venue = '';
      let courseTitle = '';
      let courseCode = '';
      
      if (tSlot && mySlots.has(tSlot)) {
        slotOccupied = true;
        const c = courses.find(mc => mc.slots.includes(tSlot));
        if (c) {
          venue = c.venue;
          courseTitle = c.title;
          courseCode = c.code;
          if (c.type?.toLowerCase().includes('embedded') && venue.includes('/')) {
            venue = venue.split('/')[0].trim();
          }
        }
      } else if (lSlot && mySlots.has(lSlot)) {
        slotOccupied = true;
        const c = courses.find(mc => mc.slots.includes(lSlot));
        if (c) {
          venue = c.venue;
          courseTitle = c.title;
          courseCode = c.code;
          if (c.type?.toLowerCase().includes('embedded') && venue.includes('/')) {
            const parts = venue.split('/');
            venue = parts.length > 1 ? parts[1].trim() : parts[0].trim();
          }
        }
      }

      if (slotOccupied) {
        if (day.id === 'monday') isMondayFree = false;
        if (day.id === 'friday') isFridayFree = false;

        if (isMorning) morningOccupied = true;
        else eveningOccupied = true;

        dailyClasses.push({
          startMins: timeToMinutes(p.start as string),
          endMins: timeToMinutes(p.end as string),
          venue,
          title: courseTitle,
          code: courseCode,
          startTime: p.start as string,
          endTime: p.end as string
        });
      }
    });

    if (!morningOccupied) freeHalfDays++;
    if (!eveningOccupied) freeHalfDays++;

    // Sort classes by start time
    dailyClasses.sort((a, b) => a.startMins - b.startMins);

    let dayGaps = 0;
    for (let i = 1; i < dailyClasses.length; i++) {
      const prev = dailyClasses[i - 1];
      const curr = dailyClasses[i];
      const gap = curr.startMins - prev.endMins;
      
      if (gap > 5) {
        dayGaps += gap;
        gapDetails.push({
          day: day.id,
          startMin: prev.endMins,
          endMin: curr.startMins,
          durationMins: gap,
          fromClass: `${prev.code} (${prev.title})`,
          toClass: `${curr.code} (${curr.title})`,
          fromTime: prev.endTime,
          toTime: curr.startTime
        });
      }
      
      if (gap >= 0 && gap <= 15) {
        const getBlock = (v: string) => v.split('-')[0].trim();
        const prevBlock = getBlock(prev.venue);
        const currBlock = getBlock(curr.venue);
        // NIL or unassigned venues shouldn't trigger dashes
        if (prevBlock && currBlock && prevBlock !== 'NIL' && currBlock !== 'NIL' && prevBlock !== currBlock) {
          buildingDashes++;
          dashDetails.push({
            fromClass: `${prev.code} (${prev.title})`,
            toClass: `${curr.code} (${curr.title})`,
            fromTime: prev.endTime,
            toTime: curr.startTime,
            day: day.label,
            fromBlock: prevBlock,
            toBlock: currBlock
          });
        }
      }
    }
    gapsPerDay[day.id] = dayGaps;
    totalGapMinutes += dayGaps;
  });

  return {
    halfDays: freeHalfDays,
    gaps: totalGapMinutes,
    buildingDashes,
    longWeekend: isFridayFree || isMondayFree,
    dashDetails,
    gapDetails
  };
};
