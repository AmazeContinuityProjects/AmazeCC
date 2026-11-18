/**
 * Unified Authentication & Identity Domain Types for AmazeCC.
 *
 * Consolidates student identity, profiles, and credential vault tokens into a
 * single, consistent model.
 */

import type { CredentialVaultSession } from "./storage";

export interface UnifiedUserIdentity {
  /** Normalized primary registration number (e.g., "25BLC1081") */
  regNumber: string;
  /** Full student name */
  name: string;
  /** User-customized nickname or display name */
  friendlyName: string;
  /** Academic programme (e.g., "B.Tech - Computer Science and Engineering") */
  programme?: string;
  /** School name or code (e.g., "SCOPE", "SAS") */
  school?: string;
  /** Campus code (e.g., "VIT, Chennai", "CHN") */
  campus?: string;
  /** Official email address */
  email?: string;
  /** Mobile / phone number */
  phone?: string;
  /** Gender if available */
  gender?: string;
  /** Profile photo URL or base64 avatar */
  photo?: string;
  /** Blood group */
  bloodGroup?: string;
  /** Active credential vault session metadata */
  session?: CredentialVaultSession;
  /** Custom profile images dictionary (e.g., custom avatar overrides) */
  customImages?: Record<string, string>;
  /** Timestamp when identity was derived/cached */
  updatedAt: number;
}
