/**
 * Unified Events & Notices Domain Types for AmazeCC.
 *
 * Unifies registered EventHub events, official circulars, and registration appointments.
 */

import type { EventHubRegistration } from "./data/eventhub";
import type { CircularItem, RegistrationScheduleResponse } from "./storage";

export interface UnifiedEventsAndNotices {
  /** Events the student has registered for */
  registeredEvents: EventHubRegistration[];
  /** Categorized circulars tree from VTOP */
  circulars: CircularItem[];
  /** Course registration schedule and assigned time-window */
  registrationSchedule?: RegistrationScheduleResponse;
  /** Last updated timestamp */
  updatedAt: number;
}
