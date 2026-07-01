export const fallbackHubs = [
  { hub_id: 1, hub_name: "VIT Chennai" },
  { hub_id: 2, hub_name: "Chennai Airport" },
  { hub_id: 3, hub_name: "Chennai Central Railway Station" },
  { hub_id: 4, hub_name: "Tambaram Railway Station" },
  { hub_id: 5, hub_name: "Chengalpattu Railway Station" },
  { hub_id: 6, hub_name: "Koyambedu Bus Stand" },
  { hub_id: 7, hub_name: "Kelambakkam" },
  { hub_id: 8, hub_name: "Sholinganallur" },
  { hub_id: 9, hub_name: "T Nagar" },
  { hub_id: 10, hub_name: "Guindy" },
  { hub_id: 11, hub_name: "OMR" },
  { hub_id: 12, hub_name: "Perungudi" },
  { hub_id: 13, hub_name: "Thoraipakkam" },
  { hub_id: 14, hub_name: "Velachery" },
];

export function dedupeHubs(hubs: { hub_id: number; hub_name: string }[]) {
  const seen = new Set<string>();
  return hubs.filter(h => {
    const key = h.hub_name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const LOCAL_TRIPS_KEY = "cabshare_local_trips";

export function readJsonResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) return null;
  return res.json();
}

export function getLocalTrips() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_TRIPS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveLocalTrips(trips: any[]) {
  localStorage.setItem(LOCAL_TRIPS_KEY, JSON.stringify(trips));
}

export function createLocalTrip(payload: any, cabShareUser: any, hubs = fallbackHubs) {
  const hub = hubs.find((item) => Number(item.hub_id) === Number(payload.hub_id));
  const fromHub = hubs.find((item) => Number(item.hub_id) === Number(payload.from_hub_id));
  const trip = {
    trip_id: Date.now(),
    ...payload,
    hub_name: hub?.hub_name || "Selected Hub",
    from_hub_name: fromHub?.hub_name || undefined,
    reg_number: cabShareUser.reg_number,
    name: cabShareUser.name || cabShareUser.reg_number,
    owner_name: cabShareUser.name || cabShareUser.reg_number,
    owner_phone: cabShareUser.phone_number,
    status: "active",
    requests: [],
    local_only: true,
  };
  saveLocalTrips([trip, ...getLocalTrips()]);
  return trip;
}
