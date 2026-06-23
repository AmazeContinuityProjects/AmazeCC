import { ParsedCourse, Friend, TimetableState } from "../types";

export interface GeneratorParams {
  targetCodes: string[];
  optionsPerCourseWithPeriods: (ParsedCourse & { periods: {day: string, startMin: number, endMin: number}[] })[][];
  schema: any;
  friends: Friend[];
  socialScoreGroupMethod: "intersection" | "cumulative";
  generatorNoLimit: boolean;
  generatorMinHalfDays: number;
  generatorSortBy: "social" | "halfdays" | "compactness" | "balanced";
}

export const generateTimetablesAsync = (params: GeneratorParams): Promise<TimetableState[]> => {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../workers/generator.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        const { type, error, results } = e.data;
        if (type === "error") {
          reject(new Error(error));
        } else if (type === "success") {
          resolve(results);
        }
        worker.terminate();
      };
      
      worker.onerror = (e) => {
        reject(new Error(e.message || "Unknown worker error"));
        worker.terminate();
      };

      worker.postMessage(params);
    } catch (e: any) {
      reject(e);
    }
  });
};
