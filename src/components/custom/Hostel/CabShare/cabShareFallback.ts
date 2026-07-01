export const fallbackHubs = [
  { hub_id: 1, hub_name: "Chennai Airport" },
  { hub_id: 2, hub_name: "Tambaram Railway Station" },
  { hub_id: 3, hub_name: "Chengalpattu Railway Station" },
  { hub_id: 4, hub_name: "Kelambakkam" },
  { hub_id: 5, hub_name: "VIT Chennai" },
];

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
  const trip = {
    trip_id: Date.now(),
    ...payload,
    hub_name: hub?.hub_name || "Selected Hub",
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
