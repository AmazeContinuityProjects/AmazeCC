"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw, Search, User, XCircle, Mail, Phone, MapPin, Badge, Building2, IdCard, Info } from "lucide-react";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

const StaffCard = ({ data }: { data: Record<string, string> }) => {
  const getFacultyName = (data: Record<string, string>) => data['Faculty Name'] || data['Name of the Faculty'] || data['Name'] || data['name'] || data['faculty_name'] || 'N/A';
  const getDesignation = (data: Record<string, string>) => data['Faculty Designation'] || data['Designation'] || data['designation'] || data['Post'] || data['post'] || 'N/A';
  const getDepartment = (data: Record<string, string>) => data['Faculty Department'] || data['Department'] || data['department'] || data['School'] || data['school'] || 'N/A';
  const getEmail = (data: Record<string, string>) => data['Faculty Email'] || data['Email ID'] || data['Email'] || data['email'] || data['E-Mail'] || data['e-mail'] || data['Mail'] || data['mail'];
  const getPhone = (data: Record<string, string>) => data['Faculty Mobile Number'] || data['Mobile Number'] || data['Phone'] || data['phone'] || data['Mobile'] || data['mobile'] || data['Contact'] || data['contact'] || data['Phone Number'] || data['phone_number'];
  const getOfficeLocation = (data: Record<string, string>) => data['Cabin'] || data['Cabin Number'] || data['Office'] || data['office'] || data['Room'] || data['room'] || data['Location'] || data['location'];
  const getEmployeeId = (data: Record<string, string>) => data['Faculty ID'] || data['Employee ID'] || data['employee_id'] || data['ID'] || data['id'] || data['Staff ID'] || data['staff_id'];
  
  const extractedKeys = new Set([
    'Faculty Name', 'Name of the Faculty', 'Name', 'name', 'faculty_name',
    'Faculty Designation', 'Designation', 'designation', 'Post', 'post',
    'Faculty Department', 'Department', 'department', 'School', 'school',
    'Faculty Email', 'Email ID', 'Email', 'email', 'E-Mail', 'e-mail', 'Mail', 'mail',
    'Faculty Mobile Number', 'Mobile Number', 'Phone', 'phone', 'Mobile', 'mobile', 'Contact', 'contact', 'Phone Number', 'phone_number',
    'Cabin', 'Cabin Number', 'Office', 'office', 'Room', 'room', 'Location', 'location',
    'Faculty ID', 'Employee ID', 'employee_id', 'ID', 'id', 'Staff ID', 'staff_id',
  ]);
  const additionalDetails: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!extractedKeys.has(key) && value) additionalDetails[key] = value;
  }

  const name = getFacultyName(data);
  const designation = getDesignation(data);
  const department = getDepartment(data);
  const email = getEmail(data);
  const phone = getPhone(data);
  const office = getOfficeLocation(data);
  const employeeId = getEmployeeId(data);

  return (
    <CardShell className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/10 border-b border-blue-500/10 flex items-center gap-4">
        <div className="p-3 bg-blue-600 rounded-xl shrink-0">
          <User className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{name}</h3>
          {designation !== 'N/A' && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{designation}</p>}
        </div>
      </div>
      <div className="p-5 space-y-4 bg-white dark:bg-[#0a0a0a]">
        {department !== 'N/A' && (
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{department}</p>
            </div>
          </div>
        )}
        {employeeId && (
          <div className="flex items-start gap-3">
            <IdCard className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee ID</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{employeeId}</p>
            </div>
          </div>
        )}
        {office && (
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{office}</p>
            </div>
          </div>
        )}
        {email && (
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</p>
              <a href={`mailto:${email}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">{email}</a>
            </div>
          </div>
        )}
        {phone && (
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</p>
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">{phone}</a>
            </div>
          </div>
        )}
        {Object.entries(additionalDetails).length > 0 && (
          <>
            <div className="h-px bg-gray-100 dark:bg-gray-800/50 my-2" />
            {Object.entries(additionalDetails).map(([k, v]) => (
              <div key={k} className="flex items-start gap-3">
                <Info className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{k}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{v}</p>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </CardShell>
  );
};

function renderTables(tables: any[]) {
  if (!tables || tables.length === 0) return null;
  return tables.map((table: any, idx: number) => {
    const hasRows = table.headers?.length > 0 && table.rows?.length > 0;
    
    const isFacultyTable = table.headers?.some((h: string) => 
      h.toLowerCase().includes("name") || h.toLowerCase().includes("faculty") || h.toLowerCase().includes("employee")
    );

    if (isFacultyTable && hasRows) {
      return (
        <div key={idx} className="space-y-4 mb-5">
          {table.caption && <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
          {table.rows.map((row: any, ri: number) => (
            <StaffCard key={ri} data={row} />
          ))}
        </div>
      );
    }

    return (
      <CardShell key={idx}>
        <div className="p-5">
          {table.caption && <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
          {hasRows ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200  dark:border-gray-700">
                    {table.headers.map((h: string, i: number) => (
                      <th key={i} className="text-left py-2 px-2 text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row: any, ri: number) => (
                    <tr key={ri} className="border-b border-gray-100  dark:border-gray-800/50 last:border-0">
                      {table.headers.map((h: string, ci: number) => (
                        <td key={ci} className="py-2.5 px-2 text-sm text-gray-800  dark:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400  dark:text-gray-500">No data</p>
          )}
        </div>
      </CardShell>
    );
  });
}

function renderKeyValuePairs(kvp: Record<string, string>) {
  if (!kvp || Object.keys(kvp).length === 0) return null;
  return (
    <CardShell>
      <div className="p-5 space-y-3">
        {Object.entries(kvp).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">{key}</span>
            <span className="text-sm font-medium text-gray-800  dark:text-gray-200 text-right">{val || "—"}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export default function FacultyInfoTab({ loginToVTOP }: { loginToVTOP: () => Promise<Creds> }) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [initData, setInitData] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loginToVTOP().then(c => {
      setCreds(c);
      fetch(`${API_BASE}/api/faculty-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: c.csrf }),
      }).then(r => r.json()).then(setInitData).catch(() => setError("Failed to load")).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!creds || !searchTerm.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/faculty-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, searchTerm: searchTerm.trim() }),
      });
      const data = await res.json();
      if (data.success === false) setError(data.error || "Search failed");
      else setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  if (!creds || loading) {
    return (
      <SubpageLayout title="Faculty Info" onBack={() => {}}>
        <Skeleton className="h-8 w-48 rounded-lg mb-4" />
        <Skeleton className="h-12 w-full rounded-2xl mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </SubpageLayout>
    );
  }

  return (
    <SubpageLayout title="Faculty Info" onBack={() => {}}>
      {/* Search Box */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={initData?.searchField?.placeholder || "Search by name or ID..."}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 rounded-xl border border-gray-200  dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchTerm.trim()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {results && !searching && (
        <>
          {results.messages && (results.messages.warning || results.messages.error) && (
            <CardShell>
              <div className={`p-4 text-sm ${results.messages.error ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"} flex items-center gap-2`}>
                <span dangerouslySetInnerHTML={{ __html: results.messages.error || results.messages.warning }} />
              </div>
            </CardShell>
          )}
          {renderKeyValuePairs(results.keyValuePairs)}
          {renderTables(results.tables)}
          {!results.tables?.length && !results.keyValuePairs && !results.messages?.error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400  dark:text-gray-500">
              <User className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">No faculty found for "{searchTerm}"</p>
            </div>
          )}
        </>
      )}

      {!results && !searching && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400  dark:text-gray-500">
          <Search className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">Search for faculty by name or employee ID</p>
        </div>
      )}
    </SubpageLayout>
  );
}
