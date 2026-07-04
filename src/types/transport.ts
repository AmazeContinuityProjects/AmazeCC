export interface BusStop {
  stopOrder: number;
  stopName: string;
  pickupTime?: string;
}

export interface BusPlacement {
  zone: string;
  dispersalTime: string;
}

export interface BusRoute {
  id: string;
  type: string;
  route: string;
  boardingPoints: string[];
  driverPhone: string;
  driverName: string;
  whatsappGroup: string;
  busLocation: string;
  supervisorName?: string;
  supervisorPhone?: string;
  driverInchargeName?: string;
  driverInchargePhone?: string;
  stops?: BusStop[];
  placements?: BusPlacement[];
}

export interface TransportData {
  hasRegistration: boolean;
  registerNumber?: string;
  name?: string;
  programme?: string;
  branch?: string;
  routeSelected?: string;
  fpReference?: string;
  paymentStatus?: string;
  busRouteId?: string;
  qrCode?: string;
  pageCsrf?: string;
}
