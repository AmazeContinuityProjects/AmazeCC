import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FFCSTimetableTab from "../components/custom/exams/FFCSTimetableTab";

describe("FFCSTimetableTab", () => {
  it("renders the FFCS planner interface without crashing", () => {
    render(<FFCSTimetableTab />);
    expect(screen.getByText("FFCS Planner")).toBeDefined();
  });
});
