import config from "../../config.json";

const DAYS_MAP: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export type FriendClassSlot = {
  day: string;
  timeSlot: string;
  courseCode: string;
  courseTitle: string;
  venue: string;
  slotId: string;
};

export type Friend = {
  id: string; // regNumber
  name: string;
  nickname: string;
  regNumber: string;
  classSlots: FriendClassSlot[];
  color: string;
  addedAt: string;
  showInFriendsSchedule: boolean;
  showInHomePage: boolean;
};

export type FriendGroup = {
  id: string;
  name: string;
  friendIds: string[];
  createdAt: string;
};

export function exportScheduleCode(
  attendance: any[],
  name: string,
  regNumber: string
): string {
  if (!Array.isArray(attendance) || attendance.length === 0) return "";
  const slotMap = config.slotMap as any;

  // 1. Extract unique course titles (only titles are needed for UI grid)
  const uniqueTitles: string[] = [];
  const getCourseIndex = (course: any) => {
    const title = course.courseTitle || "";
    const idx = uniqueTitles.indexOf(title);
    if (idx >= 0) return idx;
    uniqueTitles.push(title);
    return uniqueTitles.length - 1;
  };

  // 2. Map attendance to shortDay, slotId, and courseIdx
  const assignments: { day: string; slotId: string; courseIdx: number }[] = [];
  attendance.forEach((course) => {
    const courseIdx = getCourseIndex(course);
    const slots = String(course.slotName || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    slots.forEach((slot) => {
      Object.keys(slotMap).forEach((shortDay) => {
        if (slotMap[shortDay]?.[slot]) {
          assignments.push({
            day: shortDay,
            slotId: slot,
            courseIdx,
          });
        }
      });
    });
  });

  // 3. Serialize titles (delimited by ;)
  const coursesString = uniqueTitles.join(";");

  // 4. Serialize assignments (delimited by , and ;)
  const assignmentsString = assignments
    .map((a) => `${a.day},${a.slotId},${a.courseIdx}`)
    .join(";");

  return `v3|${name}|${regNumber}|${coursesString}|${assignmentsString}`;
}

export function importScheduleCode(qrData: string, nickname?: string): Friend {
  try {
    if (!qrData) {
      throw new Error("Empty QR data");
    }

    let name = "";
    let regNumber = "";
    const classSlots: FriendClassSlot[] = [];

    if (qrData.startsWith("v3|")) {
      const parts = qrData.split("|");
      if (parts.length < 5) {
        throw new Error("Invalid v3 format");
      }
      name = parts[1];
      regNumber = parts[2];
      const coursesData = parts[3];
      const assignmentsData = parts[4];

      // Parse unique course titles
      const titles = coursesData.length > 0 ? coursesData.split(";") : [];

      // Parse assignments and resolve full slot details
      const slotMap = config.slotMap as any;
      if (assignmentsData.length > 0) {
        assignmentsData.split(";").forEach((aStr) => {
          const aParts = aStr.split(",");
          if (aParts.length === 3) {
            const shortDay = aParts[0];
            const slotId = aParts[1];
            const courseIdx = parseInt(aParts[2], 10);
            const title = titles[courseIdx];

            if (title !== undefined && slotMap[shortDay]?.[slotId]) {
              classSlots.push({
                day: DAYS_MAP[shortDay] || shortDay,
                timeSlot: slotMap[shortDay][slotId].time,
                courseCode: "",
                courseTitle: title,
                venue: "",
                slotId,
              });
            }
          }
        });
      }
    } else if (qrData.startsWith("v2|")) {
      const parts = qrData.split("|");
      if (parts.length < 5) {
        throw new Error("Invalid v2 format");
      }
      name = parts[1];
      regNumber = parts[2];
      const coursesData = parts[3];
      const assignmentsData = parts[4];

      // Parse unique courses
      const courses: { code: string; title: string; venue: string }[] = [];
      if (coursesData.length > 0) {
        coursesData.split(";").forEach((cStr) => {
          const cParts = cStr.split("~");
          courses.push({
            code: cParts[0] || "",
            title: cParts[1] || "",
            venue: cParts[2] || "",
          });
        });
      }

      // Parse assignments and resolve full slot details
      const slotMap = config.slotMap as any;
      if (assignmentsData.length > 0) {
        assignmentsData.split(";").forEach((aStr) => {
          const aParts = aStr.split(",");
          if (aParts.length === 3) {
            const shortDay = aParts[0];
            const slotId = aParts[1];
            const courseIdx = parseInt(aParts[2], 10);
            const course = courses[courseIdx];

            if (course && slotMap[shortDay]?.[slotId]) {
              classSlots.push({
                day: DAYS_MAP[shortDay] || shortDay,
                timeSlot: slotMap[shortDay][slotId].time,
                courseCode: course.code,
                courseTitle: course.title,
                venue: course.venue,
                slotId,
              });
            }
          }
        });
      }
    } else {
      // Legacy parsing (v1 format)
      const parts = qrData.split("|");
      if (parts.length < 2) {
        throw new Error("Invalid legacy format");
      }

      name = parts[0];
      regNumber = parts[1];
      const slotsData = parts.length > 2 ? parts.slice(2).join("|") : "";

      if (slotsData.length > 0) {
        const slotStrings = slotsData.split("||");
        for (const slotStr of slotStrings) {
          if (slotStr.length > 0) {
            const sParts = slotStr.split("|");
            if (sParts.length === 6) {
              classSlots.push({
                day: sParts[0],
                timeSlot: sParts[1],
                courseCode: sParts[2],
                courseTitle: sParts[3],
                venue: sParts[4],
                slotId: sParts[5],
              });
            }
          }
        }
      }
    }

    // Generate a consistent color based on regNumber
    const colors = [
      "#EC4899",
      "#10B981",
      "#A855F7",
      "#F59E0B",
      "#3B82F6",
      "#EF4444",
      "#14B8A6",
      "#8B5CF6",
    ];
    let hash = 0;
    for (let i = 0; i < regNumber.length; i++) {
      hash = regNumber.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    return {
      id: regNumber,
      name,
      nickname: nickname || name,
      regNumber,
      classSlots,
      color,
      addedAt: new Date().toISOString(),
      showInFriendsSchedule: true,
      showInHomePage: false,
    };
  } catch (e) {
    throw new Error(`Failed to parse QR data: ${(e as Error).message}`);
  }
}

export function getFriends(): Friend[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("friends_schedules");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveFriend(friend: Friend) {
  const friends = getFriends();
  const index = friends.findIndex((f) => f.id === friend.id);
  if (index >= 0) {
    friends[index] = friend;
  } else {
    friends.push(friend);
  }
  localStorage.setItem("friends_schedules", JSON.stringify(friends));
}

export function removeFriend(id: string) {
  const friends = getFriends();
  const filtered = friends.filter((f) => f.id !== id);
  localStorage.setItem("friends_schedules", JSON.stringify(filtered));
}

export function getFriendGroups(): FriendGroup[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("friends_groups");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveFriendGroup(group: FriendGroup) {
  const groups = getFriendGroups();
  const index = groups.findIndex((g) => g.id === group.id);
  if (index >= 0) {
    groups[index] = group;
  } else {
    groups.push(group);
  }
  localStorage.setItem("friends_groups", JSON.stringify(groups));
}

export function removeFriendGroup(id: string) {
  const groups = getFriendGroups();
  const filtered = groups.filter((g) => g.id !== id);
  localStorage.setItem("friends_groups", JSON.stringify(filtered));
}
