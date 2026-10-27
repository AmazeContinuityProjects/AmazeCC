"use client";

import dynamic from "next/dynamic";
import { useAtom } from "jotai";
import {
  allGradesDataAtom,
  attendanceDataAtom,
  calendarDataAtom,
  credentialsAtom,
  gradesDisplayIsOpenAtom,
  hostelDataAtom,
  marksDataAtom,
  moodleDataAtom,
  odHoursDataAtom,
  odHoursIsOpenAtom,
  registeredEventsAtom,
  scheduleDataAtom,
  settingsAtom,
  showIntroAtom,
} from "@/store";

function FeatureLoading() {
  return <div className="min-h-[60vh] animate-pulse bg-slate-50 dark:bg-zinc-950" role="status" aria-label="Loading introduction" />;
}

const AmazeOnboardingFlow = dynamic(() => import("../onboarding/AmazeOnboardingFlow"), { loading: FeatureLoading });

/** Owns first-run onboarding and the app data it displays. */
export default function AppIntroExperience({
  handleReloadRequest,
  onOpenCommandPalette,
}: {
  handleReloadRequest: (finalSemesterID?: string) => Promise<void>;
  onOpenCommandPalette: () => void;
}) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const [IDs] = useAtom(credentialsAtom);
  const [showIntro, setShowIntro] = useAtom(showIntroAtom);
  const [attendanceData] = useAtom(attendanceDataAtom);
  const [marksData] = useAtom(marksDataAtom);
  const [hostelData] = useAtom(hostelDataAtom);
  const [registeredEvents] = useAtom(registeredEventsAtom);
  const [moodleData] = useAtom(moodleDataAtom);
  const [ODhoursData] = useAtom(odHoursDataAtom);
  const [calendarData] = useAtom(calendarDataAtom);
  const [ScheduleData] = useAtom(scheduleDataAtom);
  const [, setGradesDisplayIsOpen] = useAtom(gradesDisplayIsOpenAtom);
  const [, setODhoursIsOpen] = useAtom(odHoursIsOpenAtom);

  if (showIntro !== true) return null;

  return (
    <AmazeOnboardingFlow
      settings={settings}
      username={IDs.VtopUsername}
      setSettings={(update: any) => {
        if (typeof update === "function") {
          setSettings(previous => {
            const next = update(previous);
            localStorage.setItem("settings", JSON.stringify(next));
            return next;
          });
        }
      }}
      onComplete={async (finalSemesterID?: string) => {
        localStorage.setItem("introDone", "true");
        setShowIntro(false);
        if (finalSemesterID && finalSemesterID !== settings.currSemesterID) {
          await handleReloadRequest(finalSemesterID);
        }
      }}
      attendanceData={attendanceData}
      marksData={marksData}
      hostelData={hostelData}
      registeredEvents={registeredEvents}
      moodleData={moodleData}
      IDs={IDs}
      profileData={IDs}
      ODhoursData={ODhoursData}
      calendarData={calendarData}
      ScheduleData={ScheduleData}
      setGradesDisplayIsOpen={setGradesDisplayIsOpen}
      setODhoursIsOpen={setODhoursIsOpen}
      handleReloadRequest={handleReloadRequest}
      onOpenCommandPalette={onOpenCommandPalette}
    />
  );
}
