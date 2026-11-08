"use client";

import dynamic from "next/dynamic";
import type ToolsTabComponent from "../tools/ToolsTab";
import type { ComponentProps } from "react";

type ToolsTabProps = ComponentProps<typeof ToolsTabComponent>;

function FeatureLoading() {
  return <div className="min-h-40 animate-pulse rounded-md bg-surface-2" role="status" aria-label="Loading tools" />;
}

const ToolsTab = dynamic(() => import("../tools/ToolsTab"), { loading: FeatureLoading });

/** Feature boundary for tool pages; its implementation is fetched on selection. */
export default function DashboardToolsFeature(props: ToolsTabProps) {
  return <div className="animate-fadeIn"><ToolsTab {...props} /></div>;
}
