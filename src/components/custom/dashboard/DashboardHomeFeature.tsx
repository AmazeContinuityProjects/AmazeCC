"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type MobileHome from "../mobile/MobileHome";
import type SimplifiedMobileHome from "../mobile/SimplifiedMobileHome";

type MobileHomeProps = ComponentProps<typeof MobileHome>;
type SimplifiedHomeProps = ComponentProps<typeof SimplifiedMobileHome>;

interface DashboardHomeFeatureProps extends MobileHomeProps {
  calendarData?: SimplifiedHomeProps["calendarData"];
  ScheduleData?: SimplifiedHomeProps["ScheduleData"];
  setActiveToolsSubTab?: SimplifiedHomeProps["setActiveToolsSubTab"];
  setGradesDisplayIsOpen?: SimplifiedHomeProps["setGradesDisplayIsOpen"];
}

function HomeLoading() {
  return (
    <div className="min-h-40 animate-pulse rounded-2xl border border-slate-200/70 bg-white/70 dark:border-white/[0.08] dark:bg-zinc-950/40" role="status" aria-label="Loading home" />
  );
}

const ClassicHome = dynamic(() => import("../mobile/MobileHome"), { loading: HomeLoading });
const SimplifiedHome = dynamic(() => import("../mobile/SimplifiedMobileHome"), { loading: HomeLoading });

/** Owns the home dashboard view-mode choice and its feature-specific inputs. */
export default function DashboardHomeFeature(props: DashboardHomeFeatureProps) {
  if (props.settings?.dashboardViewMode === "classic") {
    return <ClassicHome {...props} />;
  }

  return <SimplifiedHome {...props} />;
}
