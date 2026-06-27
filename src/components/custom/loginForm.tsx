"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { getMinimalMessage } from "@/lib/utils";

interface LoginFormProps {
  username: any;
  setUsername: any;
  password: any;
  setPassword: any;
  message: any;
  handleFormSubmit: any;
  progressBar: any;
  handleDemoClick: any;
  residentialStatus: any;
  setResidentialStatus: any;
  isDayscholarWithBus: any;
  setIsDayscholarWithBus: any;
}

export default function LoginForm({
  username,
  setUsername,
  password,
  setPassword,
  message,
  handleFormSubmit,
  progressBar,
  handleDemoClick,
  residentialStatus,
  setResidentialStatus,
  isDayscholarWithBus,
  setIsDayscholarWithBus
}: LoginFormProps) {
  const isLoading = message.startsWith("Logging");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full px-4 bg-gray-50/50 dark:bg-slate-950 midnight:bg-black transition-colors duration-300 relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-500/10 midnight:bg-blue-500/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 dark:bg-emerald-500/10 midnight:bg-emerald-500/5 blur-[120px]" />
      </div>

      {/* App Logo */}
      <div className="text-center mb-8 space-y-2 relative z-10">
        <div className="flex justify-center mb-3">
          <img src="/images/icons/AmazeCC.png" alt="AmazeCC Logo" className="h-14 md:h-16 object-contain" />
        </div>
        <p className="text-gray-500 dark:text-gray-400 midnight:text-gray-400 max-w-md mx-auto text-sm font-medium">
          Showing data from VTOP in a clean and simple way.
        </p>
      </div>

      <form
        onSubmit={handleFormSubmit}
        className="bg-white/60 dark:bg-slate-900/40 midnight:bg-white/[0.02] backdrop-blur-2xl border border-gray-200/50 dark:border-gray-800/50 midnight:border-white/10 rounded-2xl p-8 w-full max-w-md space-y-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.3)] midnight:shadow-[0_8px_30px_rgba(255,255,255,0.02)] relative z-10"
      >
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Login
        </h2>

        <div className="space-y-4">
          <input
            className="w-full border border-gray-200/80 dark:border-gray-800 midnight:border-white/10 bg-white/40 dark:bg-slate-950/40 midnight:bg-black/30 backdrop-blur-sm p-3 rounded-xl text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 midnight:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="VTOP Username"
            required
          />
          <div className="relative">
            <input
              className="w-full border border-gray-200/80 dark:border-gray-800 midnight:border-white/10 bg-white/40 dark:bg-slate-950/40 midnight:bg-black/30 backdrop-blur-sm p-3 rounded-xl text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 midnight:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="VTOP Password"
              required
            />
            <button
              type="button"
              className="absolute right-2 rounded-md p-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!isLoading && (
          <>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider">Residential Status</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setResidentialStatus("hosteller"); setIsDayscholarWithBus(false); }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    residentialStatus === "hosteller"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10"
                      : "bg-white/40 dark:bg-slate-950/40 midnight:bg-black/30 text-gray-700 dark:text-gray-300 midnight:text-gray-300 border-gray-200/80 dark:border-gray-800 midnight:border-white/10 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  Hosteller
                </button>
                <button
                  type="button"
                  onClick={() => setResidentialStatus("dayscholar")}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                    residentialStatus === "dayscholar"
                      ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10"
                      : "bg-white/40 dark:bg-slate-950/40 midnight:bg-black/30 text-gray-700 dark:text-gray-300 midnight:text-gray-300 border-gray-200/80 dark:border-gray-800 midnight:border-white/10 hover:border-blue-300 dark:hover:border-blue-700"
                  }`}
                >
                  Dayscholar
                </button>
              </div>
              {residentialStatus === "dayscholar" && (
                <label className="flex items-center gap-3 p-3 rounded-xl bg-white/40 dark:bg-slate-950/40 midnight:bg-black/30 border border-gray-200/80 dark:border-gray-800 midnight:border-white/10 cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-700">
                  <input
                    type="checkbox"
                    checked={isDayscholarWithBus}
                    onChange={(e) => setIsDayscholarWithBus(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500/50"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300">I have bus registration</span>
                </label>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 midnight:bg-blue-600 midnight:hover:bg-blue-500 py-3 rounded-xl font-bold text-white transition-all shadow-md shadow-blue-500/10 active:scale-[0.98] focus:ring-2 focus:ring-blue-400/50 cursor-pointer"
            >
              Login
            </button>
          </>
        )}

        {message && (
          <div className="flex flex-col items-center justify-center gap-3 text-sm">
            <div className="w-52 md:w-80 bg-gray-200 dark:bg-slate-800 midnight:bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-blue-500 transition-all duration-500 ease-in-out rounded-full"
                style={{ width: `${progressBar}%` }}
              ></div>
            </div>
            <span className="whitespace-pre-wrap font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 text-center text-xs">{getMinimalMessage(message)}</span>
          </div>
        )}
      </form>

      <div className="text-center mt-6 relative z-10">
        <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-500 max-w-sm mx-auto leading-relaxed">
          Not affiliated with VIT or VTOP. For educational use only.<br />
          Please read the <Link href="/privacy" className="text-blue-600 dark:text-blue-400 midnight:text-blue-400 hover:underline font-semibold">Privacy Policy</Link> & <Link href="/terms" className="text-blue-600 dark:text-blue-400 midnight:text-blue-400 hover:underline font-semibold">Terms of Service</Link> before using the app.
        </p>
      </div>

      <div className="text-center mt-4 relative z-10">
        <button
          onClick={handleDemoClick}
          className="text-sm font-semibold text-blue-600 dark:text-blue-400 midnight:text-blue-400 hover:underline transition-colors"
        >
          Try Demo Mode
        </button>
      </div>
    </div>
  );
}
