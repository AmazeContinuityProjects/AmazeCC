"use client";

import React, { useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent } from "@amazecontinuityprojects/amazeui";
import Badge from "../shared/Badge";
import { ChevronDown, ChevronRight, Trophy, TrendingDown, BarChart3, Award } from "lucide-react";

export default function MarksHistoryTab({ data }) {
  const allSemestersData = data?.grades || {};
  const semesterKeys = Object.keys(allSemestersData).filter(sem => allSemestersData[sem]);
  const [activeSem, setActiveSem] = useState(semesterKeys[semesterKeys.length - 1] || "");
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

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
  const scoredCourses = gradeList
    .map((course: any) => ({ ...course, score: Number(course.grandTotal) || 0 }))
    .filter((course: any) => course.score > 0);
  const highestCourse = [...scoredCourses].sort((a, b) => b.score - a.score)[0];
  const lowestCourse = [...scoredCourses].sort((a, b) => a.score - b.score)[0];
  const semesterAverage = scoredCourses.length > 0
    ? Math.round(scoredCourses.reduce((sum: number, course: any) => sum + course.score, 0) / scoredCourses.length)
    : 0;
  const gradeDistribution = gradeList.reduce((acc: Record<string, number>, course: any) => {
    const grade = course.grade || "-";
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});

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
                  : "bg-white  dark:bg-black text-gray-600  dark:text-gray-400 border border-gray-200  dark:border-gray-800"
              }`}
            >
              {semName}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Radar Chart */}
        <Card className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800  dark:text-gray-200 mb-2">Subject Performance</h3>
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
        <Card className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800  dark:text-gray-200 mb-2">GPA Trend</h3>
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
        <Card className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <CardContent className="p-5 flex-1 flex flex-col">
            <h3 className="text-sm font-semibold text-gray-800  dark:text-gray-200 mb-2">Marks % Trend</h3>
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {[
          ["Highest Subject", highestCourse ? `${highestCourse.courseCode} · ${highestCourse.score}%` : "-", Trophy, "text-emerald-600 dark:text-emerald-400"],
          ["Lowest Subject", lowestCourse ? `${lowestCourse.courseCode} · ${lowestCourse.score}%` : "-", TrendingDown, "text-red-600 dark:text-red-400"],
          ["Semester Average", `${semesterAverage || "-"}%`, BarChart3, "text-blue-600 dark:text-blue-400"],
          ["Grade Spread", Object.entries(gradeDistribution).map(([grade, count]) => `${grade}:${count}`).join(" ") || "-", Award, "text-purple-600 dark:text-purple-400"],
        ].map(([label, value, Icon, color]: any) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm   dark:border-gray-800 dark:bg-black">
            <Icon className={`h-4 w-4 ${color}`} />
            <p className="mt-3 truncate text-sm font-black text-gray-900 dark:text-gray-100">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Course List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 mt-2">Courses</h3>
        {gradeList.length > 0 ? (
          gradeList.map((course: any, idx: number) => {
            const key = `${course.courseCode}-${idx}`;
            const isOpen = expandedCourse === key;
            return (
              <div key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm   dark:border-gray-800 dark:bg-black">
                <button
                  onClick={() => setExpandedCourse(isOpen ? null : key)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-slate-800/70"
                >
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-black text-gray-900  dark:text-gray-100">{course.courseCode} · {course.courseTitle}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="default" size="sm" className="rounded-xl font-medium">{course.courseType}</Badge>
                      <Badge variant="default" size="sm" className="rounded-xl font-bold bg-indigo-100  dark:bg-indigo-900/30 text-indigo-700  dark:text-indigo-400">Overall {course.grandTotal}%</Badge>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="text-3xl font-black text-emerald-500 leading-none">{course.grade || '-'}</div>
                      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-400">Grade</p>
                    </div>
                    {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4  dark:border-gray-800">
                    {course.details && course.details.length > 0 && (
                      <div className="space-y-4">
                        {(() => {
                           const types = Array.from(new Set(course.details.map((d: any) => d.type || 'Theory')));
                           const showLabels = types.length > 1;
                           return types.map((typeLabel: any) => {
                             const typeDetails = course.details.filter((d: any) => (d.type || 'Theory') === typeLabel);
                             return (
                               <div key={typeLabel}>
                                 {showLabels && <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500">{typeLabel}</h5>}
                                 <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                   {typeDetails.map((detail: any, dIdx: number) => (
                                     <div key={dIdx} className="rounded-xl border border-gray-200 bg-gray-50/70 p-2 text-center dark:border-gray-800  dark:bg-slate-800">
                                       <p className="mb-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500  dark:text-gray-400" title={detail.component}>{detail.component}</p>
                                       <p className="text-sm font-bold text-gray-800  dark:text-gray-100">{detail.scoredMark} <span className="text-xs font-normal text-gray-400">/ {detail.maxMark}</span></p>
                                     </div>
                                   ))}
                                 </div>
                               </div>
                             );
                           });
                        })()}
                      </div>
                    )}
                
                    {course.range && (
                      <div className="mt-4 border-t border-gray-100 pt-4  dark:border-gray-800">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500  dark:text-gray-400">Grade Ranges</p>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
                          {Object.entries(course.range).map(([grade, rangeStr]: any, idx) => {
                            let colorClass = 'bg-gray-50 text-gray-700 border-gray-200   dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400';
                            if (grade === 'S') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200   dark:border-emerald-800/50 dark:bg-emerald-900/20 dark:text-emerald-400';
                            else if (grade === 'A') colorClass = 'bg-green-50 text-green-700 border-green-200   dark:border-green-800/50 dark:bg-green-900/20 dark:text-green-400';
                            else if (grade === 'B') colorClass = 'bg-blue-50 text-blue-700 border-blue-200   dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-400';
                            else if (grade === 'C') colorClass = 'bg-indigo-50 text-indigo-700 border-indigo-200   dark:border-indigo-800/50 dark:bg-indigo-900/20 dark:text-indigo-400';
                            else if (grade === 'D') colorClass = 'bg-purple-50 text-purple-700 border-purple-200   dark:border-purple-800/50 dark:bg-purple-900/20 dark:text-purple-400';
                            else if (grade === 'E') colorClass = 'bg-orange-50 text-orange-700 border-orange-200   dark:border-orange-800/50 dark:bg-orange-900/20 dark:text-orange-400';
                            else if (grade === 'F' || grade === 'N') colorClass = 'bg-red-50 text-red-700 border-red-200   dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400';

                            return (
                              <div key={idx} className={`flex flex-col items-center justify-center rounded-xl border p-2 ${colorClass}`}>
                                <span className="mb-1 text-lg font-black">{grade}</span>
                                <span className="text-center text-[10px] font-bold tracking-wider">{rangeStr}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
