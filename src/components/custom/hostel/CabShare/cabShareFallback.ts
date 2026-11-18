import { getTypedStorageItem, setTypedStorageItem } from "@/lib/storage";
import type { CabShareTrip, CabShareUser, CabShareSeatOptions } from "@/types/storage";

export interface CabShareHub {
  hub_id: number;
  hub_name: string;
}

export const fallbackHubs: CabShareHub[] = [
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

export function dedupeHubs(hubs: CabShareHub[], withFallback?: CabShareHub[]): CabShareHub[] {
  const seen = new Set<string>();
  const merged = withFallback ? [...withFallback, ...hubs] : hubs;
  return merged.filter((h) => {
    const key = h.hub_name.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function readJsonResponse(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/json")) return null;
  return res.json();
}

export function getLocalTrips(): CabShareTrip[] {
  return getTypedStorageItem("cabshare_local_trips", []) || [];
}

export function saveLocalTrips(trips: CabShareTrip[]): void {
  setTypedStorageItem("cabshare_local_trips", trips);
}

export interface CreateLocalTripPayload {
  from_hub_id: number;
  hub_id: number;
  travel_date: string;
  preferred_time: string;
  tolerance_hours: number;
  seat_options: CabShareSeatOptions;
  gender_preference: string;
  notes?: string;
  reg_number?: string;
}

export function createLocalTrip(
  payload: CreateLocalTripPayload,
  cabShareUser: Pick<CabShareUser, "reg_number"> & Partial<Pick<CabShareUser, "name" | "phone_number">>,
  hubs: CabShareHub[] = fallbackHubs,
): CabShareTrip {
  const hub = hubs.find((item) => Number(item.hub_id) === Number(payload.hub_id));
  const fromHub = hubs.find((item) => Number(item.hub_id) === Number(payload.from_hub_id));
  const trip: CabShareTrip = {
    trip_id: Date.now(),
    ...payload,
    hub_name: hub?.hub_name || "Selected Hub",
    from_hub_name: fromHub?.hub_name || undefined,
    reg_number: cabShareUser.reg_number,
    name: cabShareUser.name || cabShareUser.reg_number,
    owner_name: cabShareUser.name || cabShareUser.reg_number,
    owner_phone: cabShareUser.phone_number || undefined,
    status: "active",
    requests: [],
    local_only: true,
  };
  saveLocalTrips([trip, ...getLocalTrips()]);
  return trip;
}
