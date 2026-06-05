import React, { useState } from "react";
import 'katex/dist/katex.min.css';
import Latex from "react-latex-next";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

export default function ExamQuestion({ question, index }) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const isWrong = (opt: string) => selectedOption === opt && opt !== question.correct_answer;

  const handleReset = () => setSelectedOption(null);

  return (
    <div className="bg-white dark:bg-slate-800 midnight:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 midnight:border-gray-800 p-5 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 midnight:bg-blue-900/40 midnight:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-md">
            Q{index + 1}
          </span>
          {question.question_type && (
            <span className="bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 midnight:bg-purple-900/30 midnight:text-purple-400 text-xs px-2 py-1 rounded-md font-medium">
              {question.question_type}
            </span>
          )}
          {question.topic_name && (
            <span className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 midnight:bg-gray-800 midnight:text-gray-400 text-xs px-2 py-1 rounded-md">
              {question.topic_name}
            </span>
          )}
          {question.source_type && (
            <span className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 midnight:bg-green-900/30 midnight:text-green-400 text-xs px-2 py-1 rounded-md font-medium border border-green-200 dark:border-green-800/40">
              {question.source_type} • {question.exam_semester} {question.exam_year}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedOption && (
            <button onClick={handleReset} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 midnight:hover:text-gray-300 transition-colors" title="Reset">
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-500">
            [{question.marks || "?"} Marks]
          </div>
        </div>
      </div>

      {/* Question Text */}
      <div className="text-gray-800 dark:text-gray-200 midnight:text-gray-200 text-base leading-relaxed mb-6 overflow-x-auto">
        <Latex>{question.question_text || ""}</Latex>
      </div>

      {/* Fallback Image */}
      {question.image_url && (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 midnight:border-gray-800 bg-gray-50 dark:bg-gray-900 midnight:bg-gray-950">
          <img src={question.image_url} alt={`Question ${index + 1}`} className="max-w-full h-auto object-contain" />
        </div>
      )}

      {/* Options (MCQ) */}
      {question.question_type === 'MCQ' && question.options && Object.keys(question.options).length > 0 && (
        <div className="space-y-2.5">
          {Object.entries(question.options).map(([key, value]) => {
            const wrong = isWrong(key);

            let btnClass =
              "border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-700 midnight:hover:bg-slate-800";
            if (selectedOption) {
              if (key === question.correct_answer)
                btnClass = "border-green-500 bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/20";
              else if (wrong)
                btnClass = "border-red-500 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20";
              else btnClass = "border-gray-200 dark:border-gray-700 midnight:border-gray-800 opacity-40";
            }

            return (
              <button
                key={key}
                disabled={!!selectedOption}
                onClick={() => setSelectedOption(key)}
                className={`w-full flex items-center p-3 rounded-lg border text-left transition-all ${btnClass}`}
              >
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 midnight:bg-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300 mr-3">
                  {key}
                </div>
                <div className="flex-grow text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 overflow-x-auto">
                  <Latex>{(value as string) || ""}</Latex>
                </div>
                {selectedOption && key === question.correct_answer && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 ml-2 shrink-0" />
                )}
                {selectedOption && wrong && (
                  <XCircle className="w-5 h-5 text-red-500 ml-2 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Show Answer for Non-MCQ */}
      {question.question_type !== 'MCQ' && question.correct_answer && (
        <div className="mt-4">
          {!selectedOption ? (
            <button 
              onClick={() => setSelectedOption('SHOW_ANSWER')}
              className="text-sm px-4 py-2 bg-gray-100 dark:bg-slate-800 midnight:bg-slate-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Show Answer / Hints
            </button>
          ) : (
            <div className="p-4 bg-green-50 dark:bg-green-900/10 midnight:bg-green-900/20 border border-green-200 dark:border-green-800/40 rounded-lg">
              <h4 className="text-xs font-bold text-green-700 dark:text-green-500 uppercase tracking-wider mb-2">Answer:</h4>
              <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                <Latex>{question.correct_answer}</Latex>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
