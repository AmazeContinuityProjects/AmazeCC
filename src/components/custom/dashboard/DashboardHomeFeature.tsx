"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type SimplifiedMobileHome from "../mobile/SimplifiedMobileHome";

type SimplifiedHomeProps = ComponentProps<typeof SimplifiedMobileHome>;

interface DashboardHomeFeatureProps extends SimplifiedHomeProps {
  calendarData?: SimplifiedHomeProps["calendarData"];
  ScheduleData?: SimplifiedHomeProps["ScheduleData"];
  setActiveToolsSubTab?: SimplifiedHomeProps["setActiveToolsSubTab"];
  setGradesDisplayIsOpen?: SimplifiedHomeProps["setGradesDisplayIsOpen"];
}

function HomeLoading() {
  return (
    <div
      className="min-h-40 animate-pulse rounded-md border border-slate-200/70 bg-white/70 dark:border-white/[0.08] dark:bg-zinc-950/40"
      role="status"
      aria-label="Loading home"
    />
  );
}

const SimplifiedHome = dynamic(() => import("../mobile/SimplifiedMobileHome"), { loading: HomeLoading });

/** Renders the home dashboard. */
export default function DashboardHomeFeature(props: DashboardHomeFeatureProps) {
  return <SimplifiedHome {...props} />;
}
