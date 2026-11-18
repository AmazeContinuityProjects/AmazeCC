/**
 * Unified Campus Services & Payments Domain Types for AmazeCC.
 *
 * Unifies CabShare rides, campus bus schedules, dues status, payment receipts,
 * and student wallet balances.
 */

import type { CabShareTrip, CabShareUser } from "./storage";
import type { BusRoute, TransportData } from "./transport";
import type { PaymentsDuesData, PaymentReceipt, PaymentWalletData } from "./payments";

export interface UnifiedCampusServices {
  cabShare: {
    user?: CabShareUser;
    trips: CabShareTrip[];
  };
  transport: {
    busRoutes: BusRoute[];
    userRegistration?: TransportData;
    isPromptDismissed: boolean;
  };
  payments: {
    dues?: PaymentsDuesData;
    receipts: PaymentReceipt[];
    wallet: PaymentWalletData;
  };
  hostel?: any;
}
