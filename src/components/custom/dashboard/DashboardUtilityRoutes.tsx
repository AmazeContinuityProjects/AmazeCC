"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useAtomValue } from "jotai";
import { unifiedIdentityAtom, unifiedAcademicsAtom } from "@/store";
import type { UnifiedUserIdentity } from "@/types";
import { DashboardRoute, useDashboardNavigator } from "./DashboardNavigator";
import type BusFinderComponent from "../dayscholar/BusFinder";

type BusFinderProps = ComponentProps<typeof BusFinderComponent>;

const CabShareTab = dynamic(() => import("../hostel/CabShare/CabShareTab"));
const BusFinder = dynamic(() => import("../dayscholar/BusFinder"));
const PaymentsTab = dynamic(() => import("../PaymentsTab"));
const LibrariesTab = dynamic(() => import("../libraries/LibrariesTab"));
const EventHubTab = dynamic(() => import("../events/EventHubTab"));
const ClubHubTab = dynamic(() => import("../clubs/ClubHubTab"));
const CommunityFeed = dynamic(() => import("../clubs/CommunityFeed"));
const FreeClassroomsTab = dynamic(() => import("../exams/FreeClassroomsTab"));
const FacultyScheduleTab = dynamic(() => import("../exams/FacultyScheduleTab"));
const FriendFinderTab = dynamic(() => import("../friendfinder/FriendFinderTab"));
const PaperScannerPage = dynamic(() => import("../tools/scanner/PaperScannerPage"));
const MoreTab = dynamic(() => import("../more/MoreTab"));
const AboutTab = dynamic(() => import("../AboutTab"));
const FeedbackReportPage = dynamic(() => import("../feedback/FeedbackReportPage"));
const StudentReportPage = dynamic(() => import("../reports/StudentReportPage"));

interface DashboardUtilityRoutesProps {
  onSystemBack: () => void;
  /** Reload action for the semester pickers below; forces a full sync on switch. */
  handleReloadRequest?: (semesterId?: string, modeId?: string) => Promise<void>;
  dayscholarBuses: BusFinderProps["buses"];
  transportBuses: BusFinderProps["buses"];
  transportData: BusFinderProps["transportData"];
  transportLoading: boolean;
  refreshTransportBuses: BusFinderProps["onRefresh"];
  transportBusesLoading: boolean;
  IDs: any;
  loginToVTOP: any;
  setIsSubpageOpen: (isOpen: boolean) => void;
  registeredEvents: any;
  setRegisteredEvents: (events: any) => void;
  attendanceData: any;
  isSubpageOpen: boolean;
}

/** Lazy route roots for campus, transport, payment, and secondary pages. */
export default function DashboardUtilityRoutes({
  onSystemBack,
  handleReloadRequest,
  dayscholarBuses,
  transportBuses,
  transportData,
  transportLoading,
  refreshTransportBuses,
  transportBusesLoading,
  IDs,
  loginToVTOP,
  setIsSubpageOpen,
  registeredEvents,
  setRegisteredEvents,
  attendanceData,
  isSubpageOpen,
}: DashboardUtilityRoutesProps) {
  const { activeMoreSubTab, setActiveMoreSubTab } = useDashboardNavigator();
  const unifiedIdentity: UnifiedUserIdentity = useAtomValue(unifiedIdentityAtom);
  const unifiedAcademics = useAtomValue(unifiedAcademicsAtom);
  const resolvedIDs = IDs?.VtopUsername ? IDs : { ...IDs, VtopUsername: unifiedIdentity.regNumber };
  const resolvedAttendanceData =
    attendanceData ||
    (unifiedAcademics.courses.length > 0
      ? {
          attendance: unifiedAcademics.courses,
          semester: unifiedAcademics.semesterId,
        }
      : attendanceData);

  const busProps = {
    transportData,
    transportLoading,
    onRefresh: refreshTransportBuses,
    refreshing: transportBusesLoading,
    onBack: onSystemBack,
  };

  return (
    <>
      <DashboardRoute route="cabshare">
        <CabShareTab onBack={onSystemBack} />
      </DashboardRoute>
      {/* BusFinder owns page chrome; refresh remains in the app shell action slot. */}
      <DashboardRoute route="dayscholar">
        <BusFinder {...busProps} buses={dayscholarBuses} />
      </DashboardRoute>
      <DashboardRoute route="transport">
        <BusFinder {...busProps} buses={transportBuses} />
      </DashboardRoute>
      <DashboardRoute route="payments">
        <PaymentsTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="libraries">
        <LibrariesTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="events">
        <EventHubTab
          IDs={resolvedIDs}
          onBack={onSystemBack}
          setIsSubpageOpen={setIsSubpageOpen}
          registeredEvents={registeredEvents}
          setRegisteredEvents={setRegisteredEvents}
        />
      </DashboardRoute>
      <DashboardRoute route="clubs">
        <ClubHubTab IDs={resolvedIDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="community">
        <CommunityFeed IDs={resolvedIDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="free-class">
        <FreeClassroomsTab onBack={onSystemBack} handleReloadRequest={handleReloadRequest} />
      </DashboardRoute>
      <DashboardRoute route="faculty-schedule">
        <FacultyScheduleTab onBack={onSystemBack} handleReloadRequest={handleReloadRequest} />
      </DashboardRoute>
      <DashboardRoute route="friend-finder">
        <FriendFinderTab onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="paper-scanner">
        <PaperScannerPage onBack={onSystemBack} />
      </DashboardRoute>
      <DashboardRoute route="student-report">
        <StudentReportPage />
      </DashboardRoute>
      <DashboardRoute route="more">
        <MoreTab
          attendanceData={resolvedAttendanceData}
          activeMoreSubTab={activeMoreSubTab}
          setActiveMoreSubTab={setActiveMoreSubTab}
          IDs={resolvedIDs}
          loginToVTOP={loginToVTOP}
          isSubpageOpen={isSubpageOpen}
          setIsSubpageOpen={setIsSubpageOpen}
        />
      </DashboardRoute>
      <DashboardRoute route="about">
        <AboutTab />
      </DashboardRoute>
      <DashboardRoute route="feedback">
        <FeedbackReportPage onBack={onSystemBack} />
      </DashboardRoute>
    </>
  );
}
