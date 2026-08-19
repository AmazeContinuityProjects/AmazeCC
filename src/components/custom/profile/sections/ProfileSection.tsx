"use client";

import React from "react";
import { User } from "lucide-react";
import ProfileStatusCards from "../ProfileStatusCards";
import AcknowledgementCards from "../AcknowledgementCards";

interface ProfileSectionProps {
  creds: any;
  refreshKey: number;
  handleCardClick: (id: string) => void;
  profileData: any;
  profileImages: any;
  hostelInfo: any;
}

export default function ProfileSection({
  creds,
  refreshKey,
  handleCardClick,
  profileData,
  profileImages,
  hostelInfo,
}: ProfileSectionProps) {
  return (
    <div className="space-y-6">
      {creds && (
        <>
          <div className="space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
              Academic & Identity Status
            </h3>
            <ProfileStatusCards
              creds={creds}
              refreshKey={refreshKey}
              onCardClick={handleCardClick}
            />
          </div>

          <AcknowledgementCards creds={creds} refreshKey={refreshKey} />

          {profileImages?.proctor && (
            <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 space-y-4 shadow-2xs">
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Faculty Mentors & Leadership
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    role: "Proctor",
                    photo: profileImages.proctor.photoBase64,
                    details: profileImages.proctor.details || {},
                  },
                  ...(profileImages.hodDean?.people?.map((p: any) => ({
                    role: p.role,
                    photo: p.photoBase64,
                    details: p.details || {},
                  })) || []),
                ].map((person, idx) => (
                  <div
                    key={idx}
                    className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/70 dark:border-zinc-800/70 flex items-start gap-4"
                  >
                    {person.photo ? (
                      <img
                        src={person.photo}
                        alt={person.role}
                        className="w-14 h-14 rounded-2xl object-cover shadow-xs border border-zinc-200 dark:border-zinc-800 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs shrink-0">
                        <User size={24} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-0.5">
                        {person.role}
                      </span>
                      <p className="font-extrabold text-sm text-zinc-900 dark:text-white truncate font-outfit">
                        {person.details.name || "N/A"}
                      </p>
                      {person.details.designation && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {person.details.designation}
                        </p>
                      )}
                      <div className="mt-3 space-y-1 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-200/60 dark:border-zinc-800/60 pt-2">
                        {Object.entries(person.details)
                          .filter(([k]) => k !== "name" && k !== "designation")
                          .map(([k, val]) => (
                            <div key={k} className="truncate text-[11px]">
                              <span className="capitalize font-semibold text-zinc-400 dark:text-zinc-500">
                                {k.replace(/([A-Z])/g, " $1").trim()}:{" "}
                              </span>
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {String(val)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Personal Info Grid */}
      <div className="bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 space-y-6 shadow-2xs">
        {[
          profileData?.nativeLanguage,
          profileData?.nationality,
          profileData?.community,
          profileData?.aadharNumber,
          profileData?.mobileNumber,
        ].some(Boolean) && (
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Personal Information
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official profile records retrieved from university portal
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              {[
                ["Native Language", profileData.nativeLanguage],
                ["Native State", profileData.nativeState],
                ["Nationality", profileData.nationality],
                ["Community", profileData.community],
                ["Religion", profileData.religion],
                ["Caste", profileData.caste],
                ["Physically Challenged", profileData.physicallyChallenged],
                ["Mobile Number", profileData.mobileNumber],
                ["Friend Mobile", profileData.friendMobileNumber],
                ["Aadhar Number", profileData.aadharNumber],
                ["Blood Group", profileData.bloodGroup],
                [
                  "Hostel Status",
                  profileData.isHosteller
                    ? `${hostelInfo?.blockName || "Hostel"} - Room ${hostelInfo?.roomNo || "N/A"}`
                    : "Day Scholar",
                ],
              ]
                .filter(([, v]) => v)
                .map(([label, val]) => (
                  <div
                    key={String(label)}
                    className="p-3.5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850 space-y-1"
                  >
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      {String(label)}
                    </p>
                    <p className="font-extrabold text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 break-words font-outfit">
                      {String(val)}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}

        {(profileData?.currentAddress || profileData?.permanentAddress) && (
          <div className="space-y-4 border-t border-zinc-150 dark:border-zinc-800/80 pt-5">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit">
                Address Records
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Registered residential and communication addresses
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profileData.currentAddress && (
                <div className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Current Address
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(profileData.currentAddress)
                      .filter(([, v]) => v)
                      .map(([k, val]) => (
                        <div key={k}>
                          <p className="text-[10px] text-zinc-400 capitalize mb-0.5">{k}</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                            {String(val)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {profileData.permanentAddress && (
                <div className="bg-zinc-50/80 dark:bg-zinc-950/60 p-4 sm:p-5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-3">
                  <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                    Permanent Address
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {Object.entries(profileData.permanentAddress)
                      .filter(([, v]) => v)
                      .map(([k, val]) => (
                        <div key={k}>
                          <p className="text-[10px] text-zinc-400 capitalize mb-0.5">{k}</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                            {String(val)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
