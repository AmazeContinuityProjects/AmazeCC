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
  const friendSlots: FriendClassSlot[] = [];

  attendance.forEach((course) => {
    const slots = String(course.slotName || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    slots.forEach((slot) => {
      Object.keys(slotMap).forEach((shortDay) => {
        if (slotMap[shortDay]?.[slot]) {
          friendSlots.push({
            day: DAYS_MAP[shortDay] || shortDay,
            timeSlot: slotMap[shortDay][slot].time,
            courseCode: course.courseCode || "",
            courseTitle: course.courseTitle || "",
            venue: course.slotVenue || "",
            slotId: slot,
          });
        }
      });
    });
  });

  const slotsString = friendSlots
    .map(
      (s) =>
        `${s.day}|${s.timeSlot}|${s.courseCode}|${s.courseTitle}|${s.venue}|${s.slotId}`
    )
    .join("||");

  return `${name}|${regNumber}|${slotsString}`;
}

export function importScheduleCode(qrData: string, nickname?: string): Friend {
  try {
    const parts = qrData.split("|");
    if (parts.length < 2) {
      throw new Error("Invalid QR data format");
    }

    const name = parts[0];
    const regNumber = parts[1];
    const slotsData = parts.length > 2 ? parts.slice(2).join("|") : "";

    const classSlots: FriendClassSlot[] = [];
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
