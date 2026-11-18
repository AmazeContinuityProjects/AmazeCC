import { describe, it, expect, beforeEach } from "vitest";
import { getDefaultStore } from "jotai";
import {
  unifiedIdentityAtom,
  unifiedAcademicsAtom,
  unifiedMarksAtom,
  unifiedCampusServicesAtom,
  attendanceDataAtom,
  marksDataAtom,
  credentialsAtom,
} from "@/store";
import { setTypedStorageItem } from "@/lib/storage";
import { installLocalStorage } from "./helpers/localStorage";

const storageStub = installLocalStorage();

describe("Reactive Unified Atoms", () => {
  beforeEach(() => {
    storageStub.clear();
  });

  it("reactively provides UnifiedUserIdentity when credentials change", () => {
    const store = getDefaultStore();

    store.set(credentialsAtom, {
      VtopUsername: "25BLC1081",
      VtopPassword: "pw",
      MoodleUsername: "25BLC1081",
      MoodlePassword: "pw",
    });

    setTypedStorageItem("profile", {
      studentName: "SUGEETH JAYARAJ S A",
      school: "SCOPE",
    });

    const identity = store.get(unifiedIdentityAtom);
    expect(identity.regNumber).toBe("25BLC1081");
    expect(identity.name).toBe("SUGEETH JAYARAJ S A");
    expect(identity.school).toBe("SCOPE");
  });

  it("reactively computes UnifiedSemesterAcademics from attendanceDataAtom", () => {
    const store = getDefaultStore();

    store.set(attendanceDataAtom, {
      semesterId: "CH20262701",
      attendance: [
        {
          slNo: "1",
          courseCode: "BACSE102(L)",
          courseTitle: "Java",
          courseType: "Lab Only",
          slotName: "L31+L32",
          faculty: "50772 NATHIYA N - SAS",
          registrationDate: "01-Aug-2026",
          attendanceDate: "17-Nov-2026",
          attendedClasses: 18,
          totalClasses: 20,
          attendancePercentage: "90.00%",
          viewLink: null,
        },
      ],
    });

    const academics = store.get(unifiedAcademicsAtom);
    expect(academics.courses).toHaveLength(1);
    expect(academics.courses[0].baseCode).toBe("BACSE102");
    expect(academics.totalAttendedClasses).toBe(18);
    expect(academics.totalConductedClasses).toBe(20);
    expect(academics.overallAttendancePercentage).toBe(90);
  });

  it("reactively computes UnifiedSemesterMarks from marksDataAtom", () => {
    const store = getDefaultStore();

    store.set(marksDataAtom, {
      courses: [
        {
          classNbr: "1001",
          courseCode: "MAT1001",
          courseTitle: "Calculus",
          courseType: "Theory Only",
          courseSystem: "CAL",
          faculty: "Dr. A",
          slot: "A1",
          courseMode: "Regular",
          assessments: [
            {
              slNo: "1",
              title: "Quiz 1",
              maxMark: "10",
              weightagePercent: "5",
              status: "Scored",
              scoredMark: "10",
              weightageMark: "5",
            },
          ],
        },
      ],
    });

    const marks = store.get(unifiedMarksAtom);
    expect(marks.courses["1001"]).toBeDefined();
    expect(marks.courses["1001"].courseCode).toBe("MAT1001");
    expect(marks.courses["1001"].totalScored).toBe(10);
    expect(marks.courses["1001"].totalWeightageScored).toBe(5);
  });

  it("reactively computes UnifiedCampusServices from storage", () => {
    const store = getDefaultStore();

    setTypedStorageItem("cabshare_local_trips", [
      {
        trip_id: 1,
        reg_number: "25BLC1081",
        from_hub_id: 2,
        hub_id: 1,
        travel_date: "2026-11-16",
        preferred_time: "10:00",
        tolerance_hours: 1,
        seat_options: { requested: 1 },
        gender_preference: "any",
        hub_name: "VIT Chennai",
        status: "active",
      },
    ]);

    const campus = store.get(unifiedCampusServicesAtom);
    expect(campus.cabShare.trips).toHaveLength(1);
    expect(campus.cabShare.trips[0].hub_name).toBe("VIT Chennai");
  });
});
