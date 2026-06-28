"use client";

import { useEffect, useState } from "react";

export default function StatsCards({
  attendancePercentage,
  ODhoursData,
  setODhoursIsOpen,
  marksData,
  feedbackStatus,
  setGradesDisplayIsOpen,
  CGPAHidden,
  setCGPAHidden,
  attendancePercentageOrString,
  setAttendancePercentageOrString,
  onOpenFeedbackStatus,
}) {
  const totalODHours =
    ODhoursData && ODhoursData.length > 0 && ODhoursData[0].courses
      ? ODhoursData.reduce((sum, day) => sum + day.total, 0)
      : 0;

  const cardBase =
    "stagger-enter cursor-pointer p-6 rounded-2xl shadow hover:shadow-lg transition-all duration-300 flex-shrink-0 snap-start w-[calc(50%-8px)] md:w-auto flex flex-col items-center justify-center text-center";

  const cards = [
    {
      key: "attendance",
      label: "Attendance",
      value: attendancePercentage[attendancePercentageOrString] || 0,
      onClick: () => setAttendancePercentageOrString(attendancePercentageOrString === "percentage" ? "str" : "percentage"),
      show: true,
    },
    {
      key: "od",
      label: "OD hours",
      value: `${totalODHours}/40`,
      onClick: () => setODhoursIsOpen(true),
      show: true,
    },
    {
      key: "feedback",
      label: "Feedback",
      onClick: onOpenFeedbackStatus,
      show: !!feedbackStatus,
      customContent: (
        <div className="flex items-center justify-center gap-3 mt-2 text-center">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-600  dark:text-gray-400">
              Mid Sem
            </span>
            <span
              className={`text-base font-bold ${
                feedbackStatus?.MidSem?.Curriculum && feedbackStatus?.MidSem?.Course
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {feedbackStatus?.MidSem?.Curriculum && feedbackStatus?.MidSem?.Course
                ? "Given"
                : "Not Given"}
            </span>
          </div>
          <div className="h-8 w-[1.5px] bg-gray-300  dark:bg-gray-700 rounded-full" />
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-600  dark:text-gray-400">
              End Sem
            </span>
            <span
              className={`text-base font-bold ${
                feedbackStatus?.EndSem?.Curriculum && feedbackStatus?.EndSem?.Course
                  ? "text-green-500"
                  : "text-red-500"
              }`}
            >
              {feedbackStatus?.EndSem?.Curriculum && feedbackStatus?.EndSem?.Course
                ? "Given"
                : "Not Given"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "cgpa",
      label: "CGPA",
      value: CGPAHidden ? "###" : marksData?.cgpa?.cgpa,
      onClick: () => setCGPAHidden(!CGPAHidden),
      show: !!marksData.cgpa,
    },
    {
      key: "credits",
      label: "Credits Earned",
      value: Number(marksData?.cgpa?.creditsEarned) + Number(marksData?.cgpa?.nonGradedRequirement || 0),
      onClick: () => setGradesDisplayIsOpen(true),
      show: true,
    },
  ];

  return (
    <div data-scrollable className="overflow-x-auto md:overflow-visible snap-x snap-mandatory md:snap-none ml-4 mr-4">
      <div className="flex gap-4 py-4 px-2 md:grid md:grid-cols-4 lg:grid-cols-5">
        {cards.filter(c => c.show).map((card) => (
          <div
            key={card.key}
            className={`${cardBase} bg-white  dark:bg-black dark:border dark:border-gray-800`}
            onClick={card.onClick}
          >
            <h2 className="text-lg font-semibold text-gray-600  dark:text-gray-200">
              {card.label}
            </h2>
            {card.customContent || (
              <p className="text-3xl font-bold text-gray-900  dark:text-gray-100 mt-2 select-none">
                {card.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
