"use client";

import React, { useState, useEffect } from "react";
import 'katex/dist/katex.min.css';
import Latex from "react-latex-next";
import { CheckCircle, Clock, FileText, Settings, ArrowRight, ArrowLeft, Eye, Trash2, Save, Plus } from "lucide-react";

export default function AdminQueueTab() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedPaper, setSelectedPaper] = useState<any | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/qbank/admin/queue');
      const json = await res.json();
      if (json.success && json.data) setPapers(json.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  // We'll no longer run OCR automatically.
  // Review now acts as the manual step for pasting JSON.
  const handleReview = async (paper: any) => {
    setSelectedPaper(paper);
    fetchQuestions(paper.source_id);
  };

  const fetchQuestions = async (paperId: string) => {
    try {
      const res = await fetch('/api/qbank/admin/questions?paperId=' + encodeURIComponent(paperId));
      const json = await res.json();
      if (json.success && json.data) setQuestions(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (paperId: string) => {
    if (!confirm("Are you sure you want to reject this paper?")) return;
    try {
      await fetch("/api/qbank/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublish = async () => {
    if (!selectedPaper) return;
    try {
      await fetch("/api/qbank/admin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: selectedPaper.source_id }),
      });
      setSelectedPaper(null);
      fetchQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        alert("JSON must be an array of questions.");
        return;
      }
      const res = await fetch("/api/qbank/admin/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: selectedPaper.source_id, questions: parsed }),
      });
      const data = await res.json();
      if (data.success) {
        fetchQuestions(selectedPaper.source_id);
        setIsJsonModalOpen(false);
        setJsonInput("");
      } else {
        alert("Failed: " + data.error);
      }
    } catch (err: any) {
      alert("Invalid JSON: " + err.message);
    }
  };

  // --- Advanced Question Editor Handlers ---

  const handleUpdateQuestion = async (questionId: string, updates: any) => {
    try {
      // Optimistic UI update
      setQuestions(prev => prev.map(q => q.question_id === questionId ? { ...q, ...updates } : q));
      await fetch("/api/qbank/admin/questions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, ...updates }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedPaper) return;
    try {
      const res = await fetch("/api/qbank/admin/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: selectedPaper.source_id }),
      });
      const json = await res.json();
      if (json.success) {
        setQuestions(prev => [...prev, json.data]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      // Optimistic UI update
      setQuestions(prev => prev.filter(q => q.question_id !== questionId));
      await fetch("/api/qbank/admin/questions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleImageUpload = (questionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("Image must be smaller than 500 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      handleUpdateQuestion(questionId, { imageUrl: base64String });
    };
    reader.readAsDataURL(file);
  };

  // ─── REVIEW VIEW (Split Pane) ───
  if (selectedPaper) {
    return (
      <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 midnight:bg-black p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedPaper(null)} className="p-2 bg-white dark:bg-slate-800 midnight:bg-slate-900 rounded-lg border border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300 midnight:text-gray-400" />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Review Questions</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500">{selectedPaper.title} • {selectedPaper.course_code}</p>
            </div>
          </div>
          <button onClick={handlePublish} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg transition-colors flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Publish to Q-Bank
          </button>
        </div>

        {/* Split Pane Content */}
        <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-180px)]">
          {/* Left Pane: PDF Viewer Placeholder */}
          <div className="w-full lg:w-1/2 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
            <div className="p-3 bg-gray-100 dark:bg-slate-800/50 midnight:bg-black/50 border-b border-gray-200 dark:border-gray-700 midnight:border-gray-800 flex justify-between items-center">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-400 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" /> Source Document
              </h3>
            </div>
            <div className="flex-1 w-full bg-gray-50 dark:bg-gray-900 midnight:bg-black flex flex-col items-center justify-center p-6 text-center">
              {selectedPaper.file_url ? (
                <>
                  <FileText className="w-16 h-16 text-blue-500 mb-4 opacity-80" />
                  <h4 className="text-lg font-bold text-gray-800 dark:text-gray-200 midnight:text-gray-100 mb-2">PDF Document Attached</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 mb-6 max-w-sm">
                    Open the document in a new tab to extract questions. Once extracted by an AI, you can paste the resulting JSON format using the button on the right.
                  </p>
                  <a 
                    href={selectedPaper.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow transition-colors flex items-center gap-2"
                  >
                    <Eye className="w-5 h-5" /> View Document in New Tab
                  </a>
                </>
              ) : (
                <div className="text-gray-500 dark:text-gray-400 text-sm">No PDF attached to this paper.</div>
              )}
            </div>
          </div>

          {/* Right Pane: Question Editor */}
          <div className="w-full lg:w-1/2 flex flex-col bg-gray-50 dark:bg-gray-900 midnight:bg-black rounded-xl overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20 custom-scrollbar">
              {questions.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No questions extracted. Add them manually!</div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.question_id || idx} className="p-4 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl shadow-sm">
                    {/* Top Row: Q Number, Type, Marks, Delete */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <div className="flex items-center">
                        <span className="bg-blue-100 dark:bg-blue-900/40 midnight:bg-blue-900/40 text-blue-800 dark:text-blue-400 px-2 py-1.5 text-xs font-bold rounded-l-md border border-blue-200 dark:border-blue-800 border-r-0">Q.</span>
                        <input 
                          type="text" 
                          className="w-12 px-2 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 midnight:bg-black border border-blue-200 dark:border-blue-800 rounded-r-md text-gray-900 dark:text-gray-100 focus:outline-none"
                          value={q.question_number}
                          onChange={(e) => setQuestions(prev => prev.map(item => item.question_id === q.question_id ? { ...item, question_number: e.target.value } : item))}
                          onBlur={(e) => handleUpdateQuestion(q.question_id, { questionNumber: e.target.value })}
                          placeholder="Num"
                        />
                      </div>
                      
                      <select 
                        className="text-xs px-2 py-1.5 bg-gray-50 dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-300 focus:outline-none"
                        value={q.question_type || "DESCRIPTIVE"}
                        onChange={(e) => handleUpdateQuestion(q.question_id, { questionType: e.target.value })}
                      >
                        <option value="DESCRIPTIVE">Descriptive</option>
                        <option value="MCQ">MCQ</option>
                        <option value="NUMERICAL">Numerical</option>
                      </select>

                      <div className="flex items-center ml-auto gap-2">
                        <div className="flex items-center">
                          <input 
                            type="number" 
                            className="w-12 px-2 py-1 text-xs text-center bg-gray-50 dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 rounded-l-md text-gray-900 dark:text-gray-100 focus:outline-none"
                            value={q.marks || 0}
                            onChange={(e) => setQuestions(prev => prev.map(item => item.question_id === q.question_id ? { ...item, marks: parseInt(e.target.value) || 0 } : item))}
                            onBlur={(e) => handleUpdateQuestion(q.question_id, { marks: parseInt(e.target.value) || 0 })}
                          />
                          <span className="bg-gray-100 dark:bg-gray-800 midnight:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 text-xs border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-md">Marks</span>
                        </div>
                        <button onClick={() => handleDeleteQuestion(q.question_id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="w-full p-3 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-lg font-mono text-sm bg-gray-50 dark:bg-gray-900 midnight:bg-black text-gray-900 dark:text-gray-100 midnight:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[100px]"
                      value={q.question_text || ""}
                      onChange={(e) => setQuestions(prev => prev.map(item => item.question_id === q.question_id ? { ...item, question_text: e.target.value } : item))}
                      onBlur={(e) => handleUpdateQuestion(q.question_id, { questionText: e.target.value })}
                      placeholder="Type question text here. Use $$ for LaTeX..."
                    />

                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 midnight:bg-blue-900/15 rounded-lg border border-blue-100 dark:border-blue-800/30 midnight:border-blue-800/30">
                      <p className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 midnight:text-blue-400 font-bold mb-1">Live Preview</p>
                      <div className="text-sm text-gray-800 dark:text-gray-200 midnight:text-gray-200 overflow-x-auto min-h-[24px]">
                        <Latex>{q.question_text || ""}</Latex>
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div className="mt-4 flex items-center gap-3">
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Attached Image (Optional):</label>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="text-xs file:mr-2 file:py-1 file:px-3 file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400 dark:hover:file:bg-blue-900/40"
                        onChange={(e) => handleImageUpload(q.question_id, e)}
                      />
                      {q.image_url && (
                         <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 font-medium">Image uploaded!</span>
                            <button onClick={() => handleUpdateQuestion(q.question_id, { imageUrl: null })} className="text-xs text-red-500 hover:underline">Remove</button>
                         </div>
                      )}
                    </div>

                    {/* Type-specific inputs */}
                    {q.question_type === 'MCQ' && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 midnight:border-gray-800 space-y-3">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">MCQ Options (Use LaTeX if needed)</p>
                        {['A', 'B', 'C', 'D'].map(opt => (
                          <div key={opt} className="flex items-center gap-2">
                            <span className="w-6 text-sm font-bold text-gray-500 text-center">{opt}.</span>
                            <input 
                              type="text" 
                              className="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none"
                              value={q.options?.[opt] || ""}
                              onChange={(e) => setQuestions(prev => prev.map(item => item.question_id === q.question_id ? { ...item, options: { ...(item.options || {}), [opt]: e.target.value } } : item))}
                              onBlur={() => handleUpdateQuestion(q.question_id, { options: q.options })}
                              placeholder={`Option ${opt}`}
                            />
                            <input 
                              type="radio" 
                              name={`correct_${q.question_id}`} 
                              checked={q.correct_answer === opt}
                              onChange={() => handleUpdateQuestion(q.question_id, { correctAnswer: opt })}
                              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                              title={`Set ${opt} as Correct Answer`}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {(q.question_type === 'NUMERICAL' || q.question_type === 'DESCRIPTIVE') && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 midnight:border-gray-800">
                        <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Answer / Hints (Optional)</p>
                        <input 
                          type="text" 
                          className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 rounded-md text-gray-900 dark:text-gray-100 focus:outline-none"
                          value={q.correct_answer || ""}
                          onChange={(e) => setQuestions(prev => prev.map(item => item.question_id === q.question_id ? { ...item, correct_answer: e.target.value } : item))}
                          onBlur={(e) => handleUpdateQuestion(q.question_id, { correctAnswer: e.target.value })}
                          placeholder={q.question_type === 'NUMERICAL' ? "e.g. 42.5" : "e.g. Use the first derivative test..."}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <button onClick={handleAddQuestion} className="flex-1 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium text-sm">
                  <Plus className="w-4 h-4" /> Add New Question
                </button>
                <button onClick={() => setIsJsonModalOpen(true)} className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium text-sm">
                  <FileText className="w-4 h-4" /> Import JSON Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* JSON Import Modal */}
        {isJsonModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 midnight:border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Import Questions (JSON)</h3>
                <button onClick={() => setIsJsonModalOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-300">✕</button>
              </div>
              <div className="p-4 flex-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Paste a JSON array of questions. Note: This will OVERWRITE existing questions.</p>
                <textarea 
                  className="w-full h-64 p-3 font-mono text-xs border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-gray-50 dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={'[\n  {\n    "question_number": "1",\n    "question_type": "MCQ",\n    "marks": 2,\n    "question_text": "Sample text",\n    "options": {"A": "Opt1"},\n    "correct_answer": "A"\n  }\n]'}
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                />
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 midnight:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-slate-800/50 midnight:bg-black/50">
                <button onClick={() => setIsJsonModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
                <button onClick={handleBulkImport} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Import & Replace</button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ─── QUEUE VIEW ───
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Q-Bank Queue</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 mt-1">Manage uploaded papers, extract questions, and review before publishing.</p>
        </div>
        <button onClick={fetchQueue} className="mt-3 md:mt-0 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
          Refresh List
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20"><div className="w-8 h-8 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 midnight:bg-slate-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 midnight:border-gray-800">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30 text-gray-400" />
          <p className="font-medium text-gray-600 dark:text-gray-300">No papers in queue</p>
          <p className="text-sm mt-1 text-gray-500">Papers uploaded by students will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {papers.map((p) => (
            <div key={p.source_id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl shadow-sm transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/30 rounded-lg text-blue-500 dark:text-blue-400 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 midnight:text-white">{p.title}</h3>
                  <div className="flex gap-3 text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 mt-1">
                    <span className="font-medium">{p.course_code}</span>
                    <span>•</span>
                    <span>by {p.uploader_reg_no}</span>
                    <span>•</span>
                    <span>{p.source_type} {p.exam_semester} {p.exam_year}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 md:mt-0 flex items-center gap-2">
                {p.approval_status === "PENDING" && (
                  <>
                    <button onClick={() => handleReview(p)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors shadow-sm">
                      <FileText className="w-4 h-4" /> Review & Extract <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleReject(p.source_id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Reject">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {p.approval_status === "PENDING_Q_APPROVAL" && (
                  <button onClick={() => handleReview(p)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Final Review <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
