/**
 * STATIC HOSTEL DIRECTORY — transcribed from campus / VTOP hostel notices.
 *
 * This is NOT live VTOP data. It is kept in one labelled place so a stale entry
 * is easy to spot and update. Verify the name and numbers on VTOP (or at the
 * hostel office) before relying on them for anything time-sensitive.
 */
export const HOSTEL_CONTACTS = {
  /** Verify on VTOP — static directory entry. */
  chiefWarden: "Dr. K. Srinivasan",

  /** Verify on VTOP — static directory entries. */
  phones: {
    hostelOffice: { label: "Hostel Office", tel: "+914439931555", display: "+91 44 3993 1555" },
    wardenOffice: { label: "Warden Office", tel: "+914439931666", display: "+91 44 3993 1666" },
    medical: { label: "Medical / Ambulance", tel: "+914439931108", display: "+91 44 3993 1108" },
    gateOutingDesk: { label: "Gate Outing Desk", tel: "+914439931555", display: "+91 44 3993 1555" },
    wardenOutingCell: { label: "Warden Outing Cell", tel: "+914439931666", display: "+91 44 3993 1666" },
  },
} as const;

/** Show alongside any of the numbers above so students know they are static. */
export const HOSTEL_CONTACT_CAVEAT = "Static directory — verify on VTOP before use.";

/**
 * The known VTOP entry point used by handoffs across the hostel cluster.
 * Kept here so a dead `href="#"` is never used as a placeholder again.
 */
export const VTOP_HOSTEL_URL = "https://vtopcc.vit.ac.in/";
