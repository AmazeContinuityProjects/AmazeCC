"use client";

import React, { useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export default function MarksHistoryTab({ data }) {
  const allSemestersData = data?.grades || {};
  const semesterKeys = Object.keys(allSemestersData).filter(sem => allSemestersData[sem]);
  const [activeSem, setActiveSem] = useState(semesterKeys[semesterKeys.length - 1] || "");

  // Trend Data for Area Chart (GPA over semesters)
  const trendData = semesterKeys.map(sem => {
    const semName = sem.endsWith("1") ? `Fall '${sem.slice(4,6)}` : `Winter '${sem.slice(4,6)}`;
    const semGrades = allSemestersData[sem]?.grades || [];
    let totalMarks = 0;
    let scoredMarks = 0;
    semGrades.forEach((c: any) => {
      const score = Number(c.grandTotal);
      if (!isNaN(score)) {
        scoredMarks += score;
        totalMarks += 100; // assuming each course is out of 100
      }
    });
    const marksPercentage = totalMarks > 0 ? (scoredMarks / totalMarks) * 100 : 0;

    return {
      name: semName,
      gpa: Number(allSemestersData[sem]?.gpa || 0),
      marksPercent: Number(marksPercentage.toFixed(1)),
    };
  });

  const activeSemData = allSemestersData[activeSem];
  const gpa = activeSemData?.gpa || 0;
  const gradeList = activeSemData?.grades || [];

  // Radar Chart Data for active semester
  const radarData = gradeList.map((course: any) => ({
    subject: course.courseCode,
    score: Number(course.grandTotal) || 0,
    fullMark: 100
  }));

  const totalAssessments = gradeList.reduce((acc: number, course: any) => acc + (course.details?.length || 0), 0);

  return (
    <div className="space-y-4">
      
      {/* Performance Analysis Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 rounded-2xl shadow-sm text-white">
        <CardContent className="p-5 flex justify-between items-center">
          <div>
            <p className="text-sm font-medium text-blue-100 uppercase tracking-wider mb-1">Performance Analysis</p>
            <h2 className="text-3xl font-bold">{gpa} GPA</h2>
            <p className="text-sm text-blue-100 mt-1">{gradeList.length} Courses · {totalAssessments} Assessments</p>
          </div>
        </CardContent>
      </Card>

      {/* Semester Switcher */}
      <div className="flex w-full overflow-x-auto gap-2 py-1 scrollbar-hide" data-scrollable>
        {semesterKeys.map((sem) => {
          const semName = sem.endsWith("1") ? `Fall ${sem.slice(4,6)}` : `Winter ${sem.slice(4,6)}`;
          const isActive = activeSem === sem;
          return (
            <button
              key={sem}
              onClick={() => setActiveSem(sem)}
              className={`flex-none px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-white dark:bg-slate-800 midnight:bg-black text-gray-600 dark:text-gray-300 midnight:text-gray-400 border border-gray-200 dark:border-gray-700 midnight:border-gray-800"
              }`}
            >
              {semName}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radar Chart */}
        <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 mb-2">Subject Performance</h3>
            <div className="w-full flex-1 min-h-[250px]">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 10 }} />
                    <Radar name="Score" dataKey="score" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No data for radar chart</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Semester-wise Trend */}
        <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 mb-2">GPA Trend</h3>
            <div className="w-full flex-1 min-h-[250px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGpa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Area type="monotone" dataKey="gpa" stroke="#4ade80" strokeWidth={3} fillOpacity={1} fill="url(#colorGpa)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No trend data</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Marks Percentage Trend */}
        <Card className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-800 midnight:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 mb-2">Marks % Trend</h3>
            <div className="w-full flex-1 min-h-[250px]">
              {trendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMarksBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                    <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
                    <Bar dataKey="marksPercent" fill="url(#colorMarksBar)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">No trend data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Course List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 mt-2">Courses</h3>
        {gradeList.length > 0 ? (
          gradeList.map((course: any, idx: number) => {
            return (
              <div key={idx} className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm md:text-base">{course.courseCode} - {course.courseTitle}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-800 midnight:bg-slate-800 text-gray-600 dark:text-gray-300 midnight:text-gray-300">
                        {course.courseType}
                      </span>
                      <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 midnight:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 midnight:text-indigo-400">
                        Total: {course.grandTotal}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end justify-center">
                    <div className="text-3xl font-black text-emerald-500 leading-none">{course.grade || '-'}</div>
                  </div>
                </div>

                {course.details && course.details.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {course.details.map((detail: any, dIdx: number) => (
                      <div key={dIdx} className="bg-gray-50 dark:bg-slate-800/50 midnight:bg-slate-800 rounded-lg p-2 text-center">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-semibold uppercase tracking-wider mb-1 line-clamp-1">{detail.component}</p>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 midnight:text-gray-100">{detail.scoredMark} <span className="text-xs text-gray-400 font-normal">/ {detail.maxMark}</span></p>
                      </div>
                    ))}
                  </div>
                )}
                
                {course.range && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase font-bold tracking-wider mb-2">Grade Ranges</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                      {Object.entries(course.range).map(([grade, rangeStr]: any, idx) => {
                        let colorClass = 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700 midnight:bg-gray-800/50 midnight:text-gray-400';
                        if (grade === 'S') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 midnight:bg-emerald-900/20 midnight:text-emerald-400';
                        else if (grade === 'A') colorClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50 midnight:bg-green-900/20 midnight:text-green-400';
                        else if (grade === 'B') colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50 midnight:bg-blue-900/20 midnight:text-blue-400';
                        else if (grade === 'C') colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 midnight:bg-indigo-900/20 midnight:text-indigo-400';
                        else if (grade === 'D') colorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50 midnight:bg-purple-900/20 midnight:text-purple-400';
                        else if (grade === 'E') colorClass = 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50 midnight:bg-orange-900/20 midnight:text-orange-400';
                        else if (grade === 'F' || grade === 'N') colorClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50 midnight:bg-red-900/20 midnight:text-red-400';

                        return (
                          <div key={idx} className={`rounded-xl border p-2 flex flex-col items-center justify-center ${colorClass}`}>
                            <span className="text-lg font-black mb-1">{grade}</span>
                            <span className="text-[10px] font-bold tracking-wider text-center">{rangeStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500">No courses found for this semester.</p>
        )}
      </div>

    </div>
  );
}
