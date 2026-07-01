"use client";

import { useState, useEffect } from "react";
import SubTabStrip from "../../shared/SubTabStrip";
import CreateTrip from "./CreateTrip";
import SearchTrips from "./SearchTrips";
import MyTrips from "./MyTrips";
import { Loader2 } from "lucide-react";
import CabShareAuthModal from "./CabShareAuthModal";

export default function CabShareTab() {
  const [activeTab, setActiveTab] = useState("search");
  const [cabShareUser, setCabShareUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have auth state
    const userStr = localStorage.getItem("cabshare_user");
    if (userStr) {
      setCabShareUser(JSON.parse(userStr));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-4">
      <CabShareAuthModal 
        isOpen={!cabShareUser} 
        onAuthSuccess={(user) => {
          localStorage.setItem("cabshare_user", JSON.stringify(user));
          setCabShareUser(user);
        }} 
      />

      {cabShareUser && (
        <>
          <SubTabStrip
            tabs={[
              { id: "search", label: "Find Ride" },
              { id: "create", label: "Post Ride" },
              { id: "my-trips", label: "My Trips" },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
          />

          <div className="pt-2">
            {activeTab === "search" && <SearchTrips cabShareUser={cabShareUser} />}
            {activeTab === "create" && <CreateTrip cabShareUser={cabShareUser} onTripCreated={() => setActiveTab("my-trips")} />}
            {activeTab === "my-trips" && <MyTrips cabShareUser={cabShareUser} />}
          </div>
        </>
      )}
    </div>
  );
}
