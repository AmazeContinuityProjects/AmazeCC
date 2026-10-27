"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { DashboardRoute, useDashboardNavigator } from "./DashboardNavigator";
import type BusFinderComponent from "../dayscholar/BusFinder";

type BusFinderProps = ComponentProps<typeof BusFinderComponent>;

function FeatureLoading() {
  return <div className="min-h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" role="status" aria-label="Loading page" />;
}

const CabShareTab = dynamic(() => import("../hostel/CabShare/CabShareTab"), { loading: FeatureLoading });
const BusFinder = dynamic(() => import("../dayscholar/BusFinder"), { loading: FeatureLoading });
const PaymentsTab = dynamic(() => import("../PaymentsTab"), { loading: FeatureLoading });
const LibrariesTab = dynamic(() => import("../libraries/LibrariesTab"), { loading: FeatureLoading });
const EventHubTab = dynamic(() => import("../events/EventHubTab"), { loading: FeatureLoading });
const ClubHubTab = dynamic(() => import("../clubs/ClubHubTab"), { loading: FeatureLoading });
const CommunityFeed = dynamic(() => import("../clubs/CommunityFeed"), { loading: FeatureLoading });
const FreeClassroomsTab = dynamic(() => import("../exams/FreeClassroomsTab"), { loading: FeatureLoading });
const FacultyScheduleTab = dynamic(() => import("../exams/FacultyScheduleTab"), { loading: FeatureLoading });
const MoreTab = dynamic(() => import("../more/MoreTab"), { loading: FeatureLoading });
const AboutTab = dynamic(() => import("../AboutTab"), { loading: FeatureLoading });

interface DashboardUtilityRoutesProps {
  onSystemBack: () => void;
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
  const busProps = {
    transportData,
    transportLoading,
    onRefresh: refreshTransportBuses,
    refreshing: transportBusesLoading,
    onBack: onSystemBack,
  };

  return (
    <>
      <DashboardRoute route="cabshare"><CabShareTab onBack={onSystemBack} /></DashboardRoute>
      {/* BusFinder owns page chrome; refresh remains in the app shell action slot. */}
      <DashboardRoute route="dayscholar"><BusFinder {...busProps} buses={dayscholarBuses} /></DashboardRoute>
      <DashboardRoute route="transport"><BusFinder {...busProps} buses={transportBuses} /></DashboardRoute>
      <DashboardRoute route="payments"><div className="animate-fadeIn"><PaymentsTab loginToVTOP={loginToVTOP} onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="libraries"><div className="animate-fadeIn"><LibrariesTab loginToVTOP={loginToVTOP} onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="events">
        <div className="animate-fadeIn"><EventHubTab IDs={IDs} onBack={onSystemBack} setIsSubpageOpen={setIsSubpageOpen} registeredEvents={registeredEvents} setRegisteredEvents={setRegisteredEvents} /></div>
      </DashboardRoute>
      <DashboardRoute route="clubs"><div className="animate-fadeIn"><ClubHubTab IDs={IDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="community"><div className="animate-fadeIn"><CommunityFeed IDs={IDs} loginToVTOP={loginToVTOP} onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="free-class"><div className="animate-fadeIn"><FreeClassroomsTab onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="faculty-schedule"><div className="animate-fadeIn"><FacultyScheduleTab onBack={onSystemBack} /></div></DashboardRoute>
      <DashboardRoute route="more">
        <div className="animate-fadeIn"><MoreTab attendanceData={attendanceData} activeMoreSubTab={activeMoreSubTab} setActiveMoreSubTab={setActiveMoreSubTab} IDs={IDs} loginToVTOP={loginToVTOP} isSubpageOpen={isSubpageOpen} setIsSubpageOpen={setIsSubpageOpen} /></div>
      </DashboardRoute>
      <DashboardRoute route="about"><div className="animate-fadeIn"><AboutTab /></div></DashboardRoute>
    </>
  );
}
