import { describe, it, expect } from "vitest";
import {
  createUnifiedIdentity,
  createUnifiedAcademics,
  createUnifiedMarks,
  createUnifiedFFCSState,
  createUnifiedCampusServices,
  createUnifiedEventsAndNotices,
  createUnifiedSocialContext,
  createUnifiedAppSettings,
} from "@/lib/unifiedCreators";

describe("Unified Domain Creators", () => {
  it("creates a UnifiedUserIdentity from disparate fragments", () => {
    const identity = createUnifiedIdentity({
      rawIds: "25BLC1081",
      profile: {
        studentName: "SUGEETH JAYARAJ S A",
        programme: "B.Tech - Computer Science and Engineering",
        school: "SCOPE",
        campus: "VIT, Chennai",
        phone: "8122654796",
      },
      friendlyName: "Sugeeth",
      session: {
        activeSessionId: "sess-123",
        unlockedAt: 1700000000,
        expiresAt: 1700050000,
      },
    });

    expect(identity.regNumber).toBe("25BLC1081");
    expect(identity.name).toBe("SUGEETH JAYARAJ S A");
    expect(identity.friendlyName).toBe("Sugeeth");
    expect(identity.school).toBe("SCOPE");
    expect(identity.phone).toBe("8122654796");
    expect(identity.session?.activeSessionId).toBe("sess-123");
  });

  it("creates UnifiedSemesterAcademics with aggregate attendance and exams", () => {
    const rawAttendance = {
      semester: "CH20262701",
      attendance: [
        {
          slNo: "1",
          courseCode: "BACSE102(L)",
          courseTitle: "Problem Solving Using Java",
          courseType: "Lab Only",
          slotName: "L31+L32+L37+L38",
          faculty: "50772 NATHIYA N - SAS",
          attendedClasses: 36,
          totalClasses: 40,
          attendancePercentage: "90.00%",
          classId: "CH2026270100046",
          credits: "2",
        },
        {
          slNo: "2",
          courseCode: "BCSE101E",
          courseTitle: "Data Structures",
          courseType: "Theory Only",
          slotName: "A1+TA1",
          faculty: "12345 - DR. JOHN DOE - SCOPE",
          attendedClasses: 27,
          totalClasses: 30,
          attendancePercentage: "90.00%",
          classId: "CH2026270102069",
          credits: "4",
        },
      ],
    };

    const rawSchedule = {
      semester: "CH20262701",
      Schedule: {
        FAT: [
          {
            courseCode: "BCSE101E",
            courseTitle: "Data Structures",
            examDate: "15-Dec-2026",
            examSession: "FN",
            reportingTime: "08:30 AM",
            examTime: "09:00 AM - 12:00 PM",
            venue: "AB1-402",
            seatNo: "42",
          },
        ],
        CAT1: [],
        CAT2: [],
      },
    };

    const academics = createUnifiedAcademics({
      attendanceData: rawAttendance,
      scheduleData: rawSchedule,
      isFrozen: false,
      saturdayOverride: "MON",
    });

    expect(academics.semesterId).toBe("CH20262701");
    expect(academics.courses).toHaveLength(2);
    expect(academics.totalAttendedClasses).toBe(63);
    expect(academics.totalConductedClasses).toBe(70);
    expect(academics.overallAttendancePercentage).toBe(90);
    expect(academics.overallAttendanceFormatted).toBe("90.00%");
    expect(academics.examSchedule.fat).toHaveLength(1);
    expect(academics.examSchedule.fat[0].seatNo).toBe("42");
    expect(academics.saturdayOverride).toBe("MON");
  });

  it("creates UnifiedSemesterMarks with cohort statistics and frozen indicators", () => {
    const marks = createUnifiedMarks({
      semesterId: "CH20262701",
      rawMarks: [
        {
          classNbr: "CH2026270100046",
          courseCode: "BACSE102",
          courseTitle: "Problem Solving Using Java",
          assessments: [
            {
              slNo: "1",
              title: "Lab Assessment 1",
              maxMark: "50",
              weightagePercent: "25",
              scoredMark: "45.0",
              weightageMark: "22.5",
            },
          ],
        },
      ],
      marksStats: {
        CH2026270100046: {
          count: 65,
          mean: 38.5,
          sd: 6.2,
          assessments: {},
        },
      },
      marksFrozenTokens: [
        "CH2026270100046::overall::overall",
        "CH2026270100046::assessment::5617ed009e5b2fcfd930bc0592878aad",
      ],
      hasBackfillV2: true,
    });

    expect(marks.semesterId).toBe("CH20262701");
    expect(marks.hasBackfillV2).toBe(true);

    const course = marks.courses["CH2026270100046"];
    expect(course).toBeDefined();
    expect(course.courseCode).toBe("BACSE102");
    expect(course.totalScored).toBe(45);
    expect(course.totalWeightageScored).toBe(22.5);
    expect(course.cohortStats?.mean).toBe(38.5);
    expect(course.isFrozen).toBe(true);
    expect(course.frozenTokens).toHaveLength(2);
  });

  it("creates UnifiedFFCSState from generator options and locks", () => {
    const ffcsState = createUnifiedFFCSState({
      settings: {
        rankingMode: "none",
        defaultSortBy: "balanced",
        resultCap: 500,
      },
      layoutMode: "guided",
      courseLocks: [{ code: "BCSE101E", allowedSlots: ["A1", "TA1"], allowedFaculty: ["12345"] }],
      catalogCourses: [{ CODE: "BCSE101E", TITLE: "DSA", TYPE: "Embedded Theory", SLOT: "A1+TA1" }],
      isFacultyGuideDismissed: true,
    });

    expect(ffcsState.layoutMode).toBe("guided");
    expect(ffcsState.isFacultyGuideDismissed).toBe(true);
    expect(ffcsState.courseLocks).toHaveLength(1);
    expect(ffcsState.availableCourses).toHaveLength(1);
    expect(ffcsState.availableCourses[0].baseCode).toBe("BCSE101E");
  });

  it("creates UnifiedCampusServices combining carpool, bus routes, dues, and wallet", () => {
    const campus = createUnifiedCampusServices({
      cabTrips: [
        {
          trip_id: 1794800365116,
          reg_number: "25BLC1081",
          from_hub_id: 2,
          hub_id: 1,
          travel_date: "2026-11-16",
          preferred_time: "10:10",
          tolerance_hours: 1,
          seat_options: { requested: 2 },
          gender_preference: "mixed",
          hub_name: "VIT Chennai",
          status: "active",
        },
      ],
      busRoutes: [
        {
          id: "BUS-01",
          type: "AC",
          route: "Tambaram",
          boardingPoints: ["Tambaram"],
          driverName: "Ramesh",
          driverPhone: "9876543210",
          whatsappGroup: "link",
          busLocation: "maps",
        },
      ],
      paymentsDues: {
        hasDues: false,
        message: "No dues found",
      },
      paymentReceipts: {
        receipts: [{ receiptNumber: "39410", amount: "67150.0", date: "06-JUN-2026" }],
      },
      paymentWallet: {
        ledgerINR: [{ receiptNumber: "39410", amount: "67150.0", transactionType: "Dr" }],
        ledgerUSD: [],
      },
    });

    expect(campus.cabShare.trips).toHaveLength(1);
    expect(campus.transport.busRoutes).toHaveLength(1);
    expect(campus.payments.dues?.hasDues).toBe(false);
    expect(campus.payments.receipts).toHaveLength(1);
    expect(campus.payments.wallet.ledgerINR).toHaveLength(1);
  });

  it("creates UnifiedEventsAndNotices from registered events and circulars", () => {
    const events = createUnifiedEventsAndNotices({
      registeredEvents: [{ name: "HACKBATTLE '26", orderId: "OD123456", paymentStatus: "Paid" }],
      circulars: [{ name: "Academic Circulars", children: [] }],
      registrationSchedule: {
        success: true,
        title: "Registration Schedule",
        keyValuePairs: { userName: "SUGEETH", date: "2026-11-10" },
      },
    });

    expect(events.registeredEvents).toHaveLength(1);
    expect(events.circulars).toHaveLength(1);
    expect(events.registrationSchedule?.keyValuePairs?.userName).toBe("SUGEETH");
  });

  it("creates UnifiedSocialContext from peers, groups, and timetable caches", () => {
    const social = createUnifiedSocialContext({
      regNumber: "25BLC1081",
      identity: {
        ownerKey: "sec_123",
        handle: "AMZ-4F7K-2Q9X",
        displayName: "SUGEETH",
        semesterId: "CH20262701",
        semesterLabel: "Fall 2026-27",
        derivedAt: "2026-11-17",
        slotmapVersion: "1",
      },
      peers: [
        {
          handle: "AMZ-7X9Y-1Z2W",
          name: "Friend A",
          visibility: "full",
          shared: true,
          lastPublishedAt: "2026-11-17",
          semesterId: "CH20262701",
          isSelf: false,
        },
      ],
      groups: [],
      peerTimetables: {
        "AMZ-7X9Y-1Z2W": {
          identity: {
            handle: "AMZ-7X9Y-1Z2W",
            displayName: "Friend A",
            publishedAt: "2026-11-17",
            semesterId: "CH20262701",
          },
          visibility: "full",
          stale: false,
          busyMap: {},
        },
      },
    });

    expect(social.regNumber).toBe("25BLC1081");
    expect(social.identity?.handle).toBe("AMZ-4F7K-2Q9X");
    expect(social.peers).toHaveLength(1);
    expect(social.peerTimetables["AMZ-7X9Y-1Z2W"].identity.displayName).toBe("Friend A");
  });

  it("creates UnifiedAppSettings from theme and diagnostics", () => {
    const appSettings = createUnifiedAppSettings({
      theme: "dark",
      phDebug: "true",
      appIcon: "neon",
      activityTreeYears: [2025, 2026],
      supportTickets: [
        {
          id: "tick_1",
          ticket_number: 101,
          status: "open",
          unread_count: 0,
          last_message: "Hi",
          last_message_at: "",
          message_count: 1,
          created_at: "",
        },
      ],
    });

    expect(appSettings.theme).toBe("dark");
    expect(appSettings.phDebug).toBe(true);
    expect(appSettings.appIcon).toBe("neon");
    expect(appSettings.activityTreeYears).toEqual([2025, 2026]);
    expect(appSettings.supportTickets).toHaveLength(1);
  });
});
