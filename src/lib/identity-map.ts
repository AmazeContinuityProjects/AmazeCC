export interface IdentityKeyValueRow {
  label: string;
  value: string;
}

export interface IdentityOfficial {
  role?: string | null;
  name?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  school?: string | null;
  cabin?: string | null;
  department?: string | null;
  intercom?: string | null;
  facultyId?: string | null;
  photoBase64?: string | null;
  extras?: IdentityKeyValueRow[];
}

export interface IdentityCredential {
  account: string;
  username: string;
  password: string;
  url?: string | null;
  venueDate: string;
  seatLocation: string;
}

export interface IdentityApaar {
  hasApaar: boolean;
  fields: IdentityKeyValueRow[];
  tables: unknown[];
}

export interface IdentityBank {
  name?: string | null;
  branch?: string | null;
  address?: string | null;
  fields: IdentityKeyValueRow[];
}

export interface StudentIdentityLike {
  regNo?: string | null;
  name?: string | null;
  email?: string | null;
  mobile?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  photoBase64?: string | null;
  isHosteller?: boolean;
  program?: string | null;
  nationality?: string | null;
  nativeLanguage?: string | null;
  nativeState?: string | null;
  community?: string | null;
  religion?: string | null;
  caste?: string | null;
  physicallyChallenged?: string | null;
  aadharNumber?: string | null;
  currentAddress?: IdentityKeyValueRow[];
  permanentAddress?: IdentityKeyValueRow[];
  father?: IdentityKeyValueRow[];
  mother?: IdentityKeyValueRow[];
  guardian?: string | null;
  proctor?: IdentityOfficial | null;
  hodDean?: IdentityOfficial[];
  credentials?: IdentityCredential[];
  ranks?: { name: string; rank: string }[];
  apaar?: IdentityApaar | null;
  bank?: IdentityBank | null;
}

export function officialToDetails(o: IdentityOfficial | null | undefined): Record<string, string> {
  if (!o) return {};
  const details: Record<string, string> = {};
  if (o.name) details["Name"] = o.name;
  if (o.designation) details["Designation"] = o.designation;
  if (o.email) details["Email"] = o.email;
  if (o.phone) details["Phone"] = o.phone;
  if (o.school) details["School"] = o.school;
  if (o.cabin) details["Cabin"] = o.cabin;
  if (o.department) details["Department"] = o.department;
  if (o.intercom) details["Intercom"] = o.intercom;
  if (o.facultyId) details["Faculty ID"] = o.facultyId;
  for (const extra of o.extras || []) {
    if (extra.label && extra.value) details[extra.label] = extra.value;
  }
  return details;
}

export function mapProfileImages(identity: StudentIdentityLike) {
  const proctor = identity.proctor
    ? {
        details: officialToDetails(identity.proctor),
        photoBase64: identity.proctor.photoBase64 || null,
      }
    : null;
  const hodDean = {
    people: (identity.hodDean || [])
      .filter((o) => o.name || o.designation || (o.extras?.length ?? 0) > 0)
      .map((o) => ({
        role: o.role || "HoD / Dean",
        details: officialToDetails(o),
        photoBase64: o.photoBase64 || null,
      })),
  };
  return { success: true, proctor, hodDean };
}

function rowsToObject(rows?: IdentityKeyValueRow[]): Record<string, string> {
  if (!rows) return {};
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (row.label && row.value) out[row.label] = row.value;
  }
  return out;
}

export function mapProfile(identity: StudentIdentityLike): Record<string, unknown> {
  return {
    name: identity.name || "",
    registerNo: identity.regNo || "",
    branch: identity.program || "",
    image: identity.photoBase64 || "",
    isHosteller: identity.isHosteller === true,
    mobileNumber: identity.mobile || "",
    dob: identity.dob || "",
    gender: identity.gender || "",
    bloodGroup: identity.bloodGroup || "",
    nationality: identity.nationality || "",
    nativeLanguage: identity.nativeLanguage || "",
    nativeState: identity.nativeState || "",
    community: identity.community || "",
    religion: identity.religion || "",
    caste: identity.caste || "",
    physicallyChallenged: identity.physicallyChallenged || "",
    aadharNumber: identity.aadharNumber || "",
    guardian: identity.guardian || "",
    currentAddress: rowsToObject(identity.currentAddress),
    permanentAddress: rowsToObject(identity.permanentAddress),
    father: rowsToObject(identity.father),
    mother: rowsToObject(identity.mother),
  };
}

export function mapCredData(identity: StudentIdentityLike) {
  return {
    credentials: (identity.credentials || []).map((c) => ({
      account: c.account,
      username: c.username,
      defaultCredentials: c.password,
      url: c.url || "",
      venueDate: c.venueDate,
      seatLocation: c.seatLocation,
    })),
    ranks: identity.ranks || [],
  };
}