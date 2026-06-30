"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../../custom/Main";
import { Skeleton } from "@/components/ui/Skeleton";
import { Search, Users, Shield, Hash, Layers } from "lucide-react";
import { motion } from "framer-motion";
import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import { LoadingSpinner } from "../shared";
import ClubDetailsModal from "./ClubDetailsModal";
import { getSimilarity } from "@/lib/string-similarity";

export default function ClubHubTab({ IDs, loginToVTOP }: { IDs: any, loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }> }) {
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [publicClubDetails, setPublicClubDetails] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any | null>(null);

  useEffect(() => {
    fetchClubs();
    fetch(`${API_BASE}/api/clubs/details`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.clubs) {
          setPublicClubDetails(data.clubs);
        }
      })
      .catch(console.error);
  }, []);

  const fetchClubs = async () => {
    setLoading(true);
    setError("");
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 500));
      setClubs([
        { id: "1", name: "VOICE-IT VIT CHENNAI'S RADIO", type: "CLUB" },
        { id: "2", name: "DANCE CLUB", type: "CLUB" },
        { id: "3", name: "VITC DEBATE SOCIETY", type: "CLUB" },
        { id: "4", name: "DRAMATICS CLUB", type: "CLUB" },
        { id: "5", name: "FINE ARTS CLUB (TFAC)", type: "CLUB" },
        { id: "6", name: "ACM STUDENT CHAPTER", type: "CHAPTER" },
        { id: "7", name: "IEEE STUDENT CHAPTER", type: "CHAPTER" },
      ]);
      setLoading(false);
      return;
    }

    try {
      let currentCookies = IDs.cookies || [];
      let currentAuthID = IDs.authorizedID;
      let currentCsrf = IDs.csrf;

      if (!currentCookies.length || !currentAuthID || !currentCsrf) {
        if (loginToVTOP) {
          const creds = await loginToVTOP();
          currentCookies = creds.cookies;
          currentAuthID = creds.authorizedID;
          currentCsrf = creds.csrf;
        } else {
          throw new Error("Missing VTOP credentials. Please try reloading the page.");
        }
      }

      const res = await fetch(`${API_BASE}/api/club-enrollment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies: currentCookies,
          authorizedID: currentAuthID,
          csrf: currentCsrf,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch clubs");
      if (!data.success) throw new Error("Failed to load club data from VTOP");
      
      const parsedClubs: any[] = [];
      if (data.tables && data.tables.length > 0) {
        data.tables[0].rows.forEach((row: any) => {
          const rawName = row["Association Name (Type)"] || "";
          if (rawName) {
            // Usually format is "CLUB NAME (TYPE)"
            const typeMatch = rawName.match(/\(([^)]+)\)$/);
            const type = typeMatch ? typeMatch[1].trim() : "CLUB";
            const name = rawName.replace(/\([^)]+\)$/, "").trim();
            parsedClubs.push({
              id: row["#"] || Math.random().toString(),
              name,
              type,
            });
          }
        });
      }
      setClubs(parsedClubs);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const types = ["All", ...Array.from(new Set(clubs.map(c => c.type).filter(Boolean)))];

  const filteredClubs = clubs.filter(club => {
    const matchesSearch = club.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "All" || club.type === selectedType;
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl">
        <p>{error}</p>
        <button 
          onClick={fetchClubs}
          className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            Clubs & Chapters
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Discover all {clubs.length > 0 ? clubs.length : ""} active student organizations at VIT.
          </p>
        </div>
        
        <div className="flex flex-row items-center gap-3">
          <SearchInput placeholder="Search clubs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-64" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
          >
            {types.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredClubs.length === 0 ? (
        <EmptyState
          title="No clubs found matching your criteria."
          className="py-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClubs.map((club) => {
            let matchedDetail = null;
            for (const detail of publicClubDetails) {
              if (getSimilarity(club.name, detail.club_name) > 0.8 || (detail.club_id && getSimilarity(club.id, detail.club_id) > 0.8)) {
                matchedDetail = detail as any;
                break;
              }
            }

            return (
              <motion.div
                key={club.id}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-black rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col justify-between h-full group"
              >
                <div>
                  <div className="flex justify-between items-start mb-3 gap-3">
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {club.name}
                    </h3>
                    {matchedDetail?.logo_url && (
                      <img src={matchedDetail.logo_url} alt="Logo" className="w-10 h-10 rounded-full object-cover shrink-0 border border-gray-100 dark:border-gray-800" />
                    )}
                  </div>
                
                <div className="flex flex-wrap gap-2 mt-4 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    club.type === 'CLUB' 
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
                      : 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                  }`}>
                    {club.type === 'CLUB' ? <Users className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    {club.type}
                  </span>
                  
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400">
                    <Hash className="w-3.5 h-3.5" /> {club.id}
                  </span>
                </div>
                
                <button
                  onClick={() => {
                    // We already found the matched detail above

                    setSelectedClub({ ...club, ...matchedDetail, club_name: club.name });
                  }}
                  className="w-full mt-2 py-2.5 bg-gray-50 hover:bg-blue-50 dark:bg-gray-800/50 dark:hover:bg-blue-900/20 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold rounded-xl transition-colors"
                >
                  View Details
                </button>
              </div>
            </motion.div>
            );
          })}
        </div>
      )}
      
      <ClubDetailsModal
        isOpen={!!selectedClub}
        onClose={() => setSelectedClub(null)}
        club={selectedClub}
      />
    </motion.div>
  );
}
