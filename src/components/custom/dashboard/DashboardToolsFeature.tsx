"use client";

import ToolsTab from "../tools/ToolsTab";
import type { ComponentProps } from "react";

type ToolsTabProps = ComponentProps<typeof ToolsTab>;

/** Feature boundary for tool pages. */
export default function DashboardToolsFeature(props: ToolsTabProps) {
  return <ToolsTab {...props} />;
}
