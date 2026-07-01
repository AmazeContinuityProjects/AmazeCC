"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Car, Shield, AlertCircle } from "lucide-react";

export default function CabShareAuthModal({ isOpen, onAuthSuccess }: { isOpen: boolean, onAuthSuccess: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const idsObj = localStorage.getItem("IDs");
      if (idsObj) {
        try {
          const ids = JSON.parse(idsObj);
          if (ids.VtopUsername) setUsername(ids.VtopUsername);
          // We can optionally pre-fill password too if we want true auto-login,
          // but the user's requirement "fetch the vtop username and password from the local storage" means we should probably just do it silently.
          if (ids.VtopPassword) setPassword(ids.VtopPassword);
        } catch (e) {}
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !phoneNumber) {
      setError("Please fill all fields.");
      return;
    }
    if (phoneNumber.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/cabshare/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, phone_number: phoneNumber }),
      });
      const data = await res.json();
      if (data.success) {
        onAuthSuccess(data.user);
      } else {
        setError(data.error || data.message || "Authentication failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-slideUp">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex flex-col items-center">
          <div className="p-3 bg-white/20 rounded-full mb-3">
            <Car className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">Cab Share Setup</h2>
          <p className="text-blue-100 text-sm text-center mt-1">
            Authenticate to start sharing rides with fellow hostellers securely.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Registration Number</label>
            <input 
              type="text" 
              value={username} 
              readOnly
              className="w-full px-4 py-3 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-gray-500 cursor-not-allowed outline-none"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">VTOP Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              placeholder="Enter your VTOP password"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
            <input 
              type="tel" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
              placeholder="10-digit mobile number"
            />
            <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
              <Shield className="w-3 h-3" /> Shared only with confirmed ride matches.
            </p>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
