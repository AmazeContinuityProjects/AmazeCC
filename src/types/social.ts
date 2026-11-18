/**
 * Unified Social Timetable Domain Types for AmazeCC.
 *
 * Unifies the student's identity handle, peer connections, peer timetables,
 * groups, and sharing grants.
 */

import type { SocialIdentity, SocialPeer, SocialStoredGrant } from "../lib/social/types";
import type { SocialTimetableCache, SocialGroup } from "./storage";

export interface UnifiedSocialContext {
  /** The student's public AMZ handle identity */
  identity?: SocialIdentity;
  /** Active peers connected to the student */
  peers: SocialPeer[];
  /** Peer groups the student belongs to */
  groups: SocialGroup[];
  /** Cached peer timetables keyed by peer handle */
  peerTimetables: Record<string, SocialTimetableCache>;
  /** Pairing grant tokens */
  grants: SocialStoredGrant[];
  /** Active registration number */
  regNumber: string;
}
