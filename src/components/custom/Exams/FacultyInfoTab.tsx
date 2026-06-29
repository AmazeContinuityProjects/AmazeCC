"use client";
import { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { Search, User, XCircle, Mail, Phone, MapPin, Building2, IdCard } from "lucide-react";

interface School {
  id: string;
  school_name: string;
}

interface FacultyProfile {
  id: string;
  name: string;
  designation: string;
  imageUrl: string;
  profileUrl: string;
  email: string;
  employeeId: string;
  intercom: string;
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

const FacultyCard = ({ profile }: { profile: FacultyProfile }) => {
  return (
    <CardShell className="overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-4 bg-blue-500/10 dark:bg-blue-500/10 border-b border-blue-500/10 flex items-center gap-4">
        {profile.imageUrl ? (
          <img src={profile.imageUrl} alt={profile.name} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-blue-100" />
        ) : (
          <div className="p-3 bg-blue-600 rounded-xl shrink-0">
            <User className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {profile.profileUrl ? (
              <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{profile.name}</a>
            ) : (
              profile.name
            )}
          </h3>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{profile.designation}</p>
        </div>
      </div>
      <div className="p-5 space-y-4 bg-white dark:bg-[#0a0a0a]">
        {profile.employeeId && (
          <div className="flex items-start gap-3">
            <IdCard className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employee ID</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.employeeId}</p>
            </div>
          </div>
        )}
        {profile.intercom && (
          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Intercom</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile.intercom}</p>
            </div>
          </div>
        )}
        {profile.email && (
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</p>
              <a href={`mailto:${profile.email}`} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all">{profile.email}</a>
            </div>
          </div>
        )}
      </div>
    </CardShell>
  );
};

export default function FacultyInfoTab({ loginToVTOP, setActiveSubTab }: { loginToVTOP?: any, setActiveSubTab?: (t: string) => void }) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [faculties, setFaculties] = useState<FacultyProfile[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/faculty/schools`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setSchools(data.schools);
          if (data.schools.length > 0) {
            handleSelectSchool(data.schools[0].id);
          }
        } else {
          setError(data.error || "Failed to load schools");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSchools(false));
  }, []);

  const handleSelectSchool = async (schoolId: string) => {
    setSelectedSchool(schoolId);
    setLoadingFaculties(true);
    setError(null);
    setFaculties([]);
    setSearchTerm("");

    try {
      const res = await fetch(`${API_BASE}/api/faculty/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      const data = await res.json();
      if (data.success === false) {
        setError(data.error || "Failed to fetch faculty list");
      } else {
        setFaculties(data.faculties || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingFaculties(false);
    }
  };

  const filteredFaculties = useMemo(() => {
    if (!searchTerm.trim()) return faculties;
    const lower = searchTerm.toLowerCase();
    return faculties.filter(f => 
      f.name.toLowerCase().includes(lower) || 
      f.employeeId.toLowerCase().includes(lower) ||
      f.email.toLowerCase().includes(lower) ||
      f.designation.toLowerCase().includes(lower)
    );
  }, [faculties, searchTerm]);

  if (loadingSchools) {
    return (
      <SubpageLayout title="Global Faculty Directory" onBack={() => setActiveSubTab && setActiveSubTab("overview")}>
        <Skeleton className="h-10 w-full rounded-2xl mb-4" />
        <Skeleton className="h-12 w-full rounded-2xl mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </SubpageLayout>
    );
  }

  return (
    <SubpageLayout title="Global Faculty Directory" onBack={() => setActiveSubTab && setActiveSubTab("overview")}>
      
      {/* School Selector Pills */}
      <div className="flex overflow-x-auto pb-4 mb-2 gap-2 hide-scrollbar">
        {schools.map(school => (
          <button
            key={school.id}
            onClick={() => handleSelectSchool(school.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedSchool === school.id 
                ? "bg-blue-600 text-white" 
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {school.school_name}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 dark:text-red-500 bg-red-50 dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {selectedSchool && (
        <>
          {/* Instant Client-side Search Box */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Instant search by name, ID, or email..."
              className="w-full pl-10 pr-4 py-3 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {loadingFaculties ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : (
            <>
              {filteredFaculties.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFaculties.map((f, i) => (
                    <FacultyCard key={f.id || i} profile={f} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <User className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm font-medium">No faculty found matching "{searchTerm}"</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!selectedSchool && !loadingSchools && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <Building2 className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-sm font-medium">Select a school to view its faculty directory</p>
        </div>
      )}

    </SubpageLayout>
  );
}
