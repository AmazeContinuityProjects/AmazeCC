"use client";

import dynamic from "next/dynamic";
import type ToolsTabComponent from "../tools/ToolsTab";
import type { ComponentProps } from "react";
import { PageSkeleton } from "../shared/primitives/PageSkeleton";

type ToolsTabProps = ComponentProps<typeof ToolsTabComponent>;

function FeatureLoading() {
  return <PageSkeleton label="Loading tools" />;
}

const ToolsTab = dynamic(() => import("../tools/ToolsTab"), { loading: FeatureLoading });

/** Feature boundary for tool pages; its implementation is fetched on selection. */
export default function DashboardToolsFeature(props: ToolsTabProps) {
  return <div className="animate-fadeIn"><ToolsTab {...props} /></div>;
}
