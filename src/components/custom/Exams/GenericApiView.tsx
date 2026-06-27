"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE } from "../Main";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronDown, Inbox, Send } from "lucide-react";
import { LoadingSpinner, ErrorDisplay, EmptyState } from "@/components/custom/shared";

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="text-sm font-medium text-gray-800  dark:text-gray-200 break-words">{value || "—"}</p>
  </div>
);

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

interface GenericApiViewProps {
  endpoint: string;
  title: string;
  creds: Creds;
  extraParams?: Record<string, any>;
  refreshKey?: number;
  writable?: boolean;
}

const LS_PREFIX = "uni_cc_generic_";
const cache = new Map<string, any>();
export const clearApiCache = () => {
  cache.clear();
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX) || k.startsWith("cache_"));
  keys.forEach(k => localStorage.removeItem(k));
};

export default function GenericApiView({ endpoint, title, creds, extraParams, refreshKey = 0, writable = false }: GenericApiViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [submitResult, setSubmitResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const credsRef = useRef(creds);
  credsRef.current = creds;
  const cacheKey = `${endpoint}:${selectedSemester || ""}:${JSON.stringify(extraParams || {})}`;

  const fetchData = useCallback(async (semesterId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { cookies, authorizedID, csrf } = credsRef.current;
      const body: Record<string, any> = { cookies, authorizedID, csrf, ...(extraParams || {}) };
      if (semesterId) body.semesterId = semesterId;
      const res = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success === false) {
        setError(result.error || result.message || "Failed to load data");
      } else {
        setData(result);
        const ck = `${endpoint}:${semesterId || ""}:${JSON.stringify(extraParams || {})}`;
        cache.set(ck, result);
        localStorage.setItem(LS_PREFIX + ck, JSON.stringify(result));
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [endpoint, extraParams]);

  const restoreCache = useCallback(() => {
    const cached = cache.get(cacheKey);
    if (cached) { setData(cached); return true; }
    try {
      const raw = localStorage.getItem(LS_PREFIX + cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        cache.set(cacheKey, parsed);
        setData(parsed);
        return true;
      }
    } catch {}
    try {
      const raw = localStorage.getItem("cache_" + endpoint);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.success !== false) {
          cache.set(cacheKey, parsed);
          setData(parsed);
          return true;
        }
      }
    } catch {}
    return false;
  }, [cacheKey, endpoint]);

  useEffect(() => {
    if (!restoreCache()) fetchData(selectedSemester || undefined);
  }, [refreshKey, selectedSemester, endpoint]);

  const handleSemesterChange = (value: string) => {
    setSelectedSemester(value);
    const semKey = `${endpoint}:${value}:${JSON.stringify(extraParams || {})}`;
    const cached = cache.get(semKey);
    if (cached) {
      setData(cached);
    } else {
      fetchData(value);
    }
  };

  const handleFormFieldChange = (name: string, value: string) => {
    setFormValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const { cookies, authorizedID, csrf } = credsRef.current;
      const res = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf, formData: formValues }),
      });
      const result = await res.json();
      if (result.success === false) {
        setSubmitResult({ error: result.error || result.message || "Submission failed" });
      } else {
        setSubmitResult(result);
        setFormValues({});
      }
    } catch (err: any) {
      setSubmitResult({ error: err.message || "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  const semesterOptions = data?.selectOptions ? (
    Object.entries(data.selectOptions).find(([key, val]: any) =>
      val?.some?.((o: any) => o.value && (o.text?.toLowerCase().includes("sem") || key.toLowerCase().includes("sem")))
    )
  ) : undefined;

  const hasSemestersResponse = data?.semesters !== undefined;
  const semestersKeys = data?.semesters ? Object.keys(data.semesters) : [];

  const renderMessages = (msgs: any) => {
    if (!msgs) return null;
    const { warning, error: msgError, success } = msgs;
    return (
      <>
        {warning && <div className="warning-banner mb-5" dangerouslySetInnerHTML={{ __html: warning }} />}
        {msgError && <ErrorDisplay message={msgError} />}
        {success && <div className="success-banner mb-5" dangerouslySetInnerHTML={{ __html: success }} />}
      </>
    );
  };

  const renderTables = (tables: any[]) => {
    if (!tables || tables.length === 0) return null;
    return tables.map((table: any, idx: number) => {
      const hasRows = table.headers?.length > 0 && table.rows?.length > 0;
      const columns = table.headers.map((h: string) => ({ key: h, label: h }));
      return (
        <div key={idx} className="solid-card mb-5">
          <div className="p-5">
            {table.caption && <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
            {hasRows ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200  dark:border-gray-700">
                      {table.headers.map((h: string, i: number) => (
                        <th key={i} className="text-left py-2 px-2 text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row: any, ri: number) => (
                      <tr key={ri} className="border-b border-gray-100  dark:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        {table.headers.map((h: string, ci: number) => (
                          <td key={ci} className="py-2.5 px-2 text-gray-800  dark:text-gray-200 whitespace-nowrap">
                            {typeof row === "object" ? (row[h] || row[ci] || "") : (Array.isArray(row) ? row[ci] || "" : "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No data available" className="py-4" />
            )}
          </div>
        </div>
      );
    });
  };

  const renderKeyValues = (kv: Record<string, string> | undefined) => {
    if (!kv || Object.keys(kv).length === 0) return null;
    const entries = Object.entries(kv).filter(([k]) => !k.toLowerCase().includes("semester"));
    if (entries.length === 0) return null;
    return (
      <div className="solid-card mb-5">
        <div className="p-5">
          <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">Details</h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {entries.map(([key, val]) => (
              <Field key={key} label={key} value={String(val)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const semesterHasContent = (semData: any) => {
    if (semData.error) return true;
    return semData.tables?.length > 0
      || Object.keys(semData.keyValuePairs || {}).length > 0
      || !!semData.formFields
      || (semData?.selectOptions && Object.values(semData.selectOptions).some((v: any) => Array.isArray(v) && v.length > 0))
      || (semData?.cascadingOptions && Object.keys(semData.cascadingOptions).length > 0);
  };

  const renderSingleSemester = (semData: any, semName: string) => {
    const hasContent = semesterHasContent(semData);
    const semSelectOptions = semData?.selectOptions
      ? Object.entries(semData.selectOptions).filter(([key, val]: any) =>
          Array.isArray(val) && val.length > 0 && !key.toLowerCase().includes("sem"))
      : [];
    return (
      <div className="solid-card mb-5" key={semName}>
        <div className="p-5">
          <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{semName}</h4>
          {renderMessages(semData.messages)}
          {hasContent ? (
            <>
              {renderKeyValues(semData.keyValuePairs)}
              {renderTables(semData.tables)}
              {semData.formFields && Object.keys(semData.formFields).length > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
                  {Object.entries(semData.formFields).map(([key, field]: any) => (
                    <Field key={key} label={field.label || key} value={field.value || ""} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <EmptyState title="No data available" className="py-4" />
          )}
          {semSelectOptions.length > 0 && (
            <div className="space-y-3 mt-4">
              <h5 className="text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider">Available Options</h5>
              {semSelectOptions.map(([key, options]: any) => (
                <div key={key}>
                  <p className="text-xs font-medium text-gray-500  dark:text-gray-400 mb-1.5 capitalize">{key.replace(/-/g, " ")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(options as Array<{value: string; text: string}>).map((opt: any, i: number) => (
                      <span key={i} className="px-3 py-1.5 rounded-lg bg-gray-100  dark:bg-gray-800 text-xs font-medium text-gray-600  dark:text-gray-300">{opt.text}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {semData?.cascadingOptions && Object.keys(semData.cascadingOptions).length > 0 && (
            <div className="space-y-4 mt-5 pt-4 border-t border-gray-100  dark:border-gray-700/50">
              <h5 className="text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider">Available Minor / Honour Combinations</h5>
              {Object.entries(semData.cascadingOptions).map(([fieldName, fieldData]: [string, any]) => (
                <div key={fieldName} className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600  dark:text-gray-300 capitalize">{fieldName.replace(/-/g, " ")}</p>
                  <div className="space-y-2 ml-2">
                    {(fieldData.options || []).map((opt: any, i: number) => (
                      <div key={i} className="bg-gray-50  dark:bg-gray-800/50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-700  dark:text-gray-200">{opt.text}</p>
                        {fieldData.children?.[opt.text]?.selectOptions && Object.entries(fieldData.children[opt.text].selectOptions).map(([childField, childOpts]: [string, any]) => (
                          <div key={childField} className="mt-2 ml-2">
                            <p className="text-[11px] font-medium text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1">{childField.replace(/-/g, " ")}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(childOpts as Array<{value: string; text: string}>).map((co: any, ci: number) => (
                                <span key={ci} className="px-2.5 py-1 rounded-md bg-white  dark:bg-gray-900 text-xs text-gray-500  dark:text-gray-400 border border-gray-200  dark:border-gray-700">{co.text}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                        {fieldData.children?.[opt.text]?.tables && fieldData.children[opt.text].tables.length > 0 && (
                          <div className="mt-2">
                            {renderTables(fieldData.children[opt.text].tables)}
                          </div>
                        )}
                        {fieldData.children?.[opt.text]?.error && (
                          <p className="text-xs text-red-500 mt-1 ml-2">{fieldData.children[opt.text].error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h3 className="text-xl font-bold text-gray-900  dark:text-gray-100 mb-4">{title}</h3>
        <div className="solid-card mb-5">
          <ErrorDisplay message={error} />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const allSelectOptions = data?.selectOptions ? Object.entries(data.selectOptions).filter(([key, val]: any) => Array.isArray(val) && val.length > 0 && !key.toLowerCase().includes("sem")) : [];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900  dark:text-gray-100">{title}</h3>

      {hasSemestersResponse ? (
        semestersKeys.length > 0 ? (
          Object.entries(data.semesters)
            .filter(([, semData]: [string, any]) => semesterHasContent(semData))
            .map(([semName, semData]: [string, any]) => {
              if (semData.error) {
                return (
                  <div className="solid-card mb-5" key={semName}>
                    <div className="p-5">
                      <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{semName}</h4>
                      <p className="error-banner">{semData.error}</p>
                    </div>
                  </div>
                );
              }
              return renderSingleSemester(semData, semName);
            })
        ) : (
          <div className="solid-card mb-5">
            <EmptyState
              icon={<Inbox className="w-10 h-10" />}
              title="No data found"
              className="py-12"
            />
          </div>
        )
      ) : (
        <>
          {renderMessages(data.messages)}

          {semesterOptions && (
            <div className="solid-card mb-5">
              <div className="p-4">
                <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-2 block">Select Semester</label>
                <div className="relative">
                  <select value={selectedSemester} onChange={(e) => handleSemesterChange(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl bg-white  dark:bg-gray-800 border border-gray-200  dark:border-gray-700 text-gray-800  dark:text-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Select --</option>
                    {(semesterOptions[1] as Array<{value: string; text: string}>).map((opt: any, i: number) => (
                      <option key={i} value={opt.value}>{opt.text}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {loading && <LoadingSpinner size="lg" className="py-8" />}

          {!loading && (
            <>
              {renderKeyValues(data.keyValuePairs)}
              {renderTables(data.tables)}
              {allSelectOptions.length > 0 && (
                <div className="solid-card mb-5">
                  <div className="p-5">
                    <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">Available Options</h4>
                    <div className="space-y-3">
                      {allSelectOptions.map(([key, options]: any) => (
                        <div key={key}>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 capitalize">{key.replace(/-/g, " ")}</p>
                          <div className="flex flex-wrap gap-2">
                            {(options as Array<{value: string; text: string}>).map((opt: any, i: number) => (
                              <span key={i} className="px-3 py-1.5 rounded-lg bg-gray-100  dark:bg-gray-800 text-xs font-medium text-gray-600  dark:text-gray-300">{opt.text}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {data.formFields && Object.keys(data.formFields).length > 0 && (writable ? (
                <div className="solid-card mb-5">
                  <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">Submit Form</h4>
                    {submitResult?.messages?.success && <div className="success-banner">{submitResult.messages.success}</div>}
                    {submitResult?.messages?.error && <div className="error-banner">{submitResult.messages.error}</div>}
                    {submitResult?.error && <div className="error-banner">{submitResult.error}</div>}
                    {Object.entries(data.formFields).map(([key, val]: any) => (
                      <div key={key}>
                        <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">{key.replace(/-/g, " ")}</label>
                        <input
                          name={key}
                          defaultValue={typeof val === "string" ? val : ""}
                          onChange={(e) => handleFormFieldChange(key, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white  dark:bg-gray-800 border border-gray-200  dark:border-gray-700 text-gray-800  dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                    <button type="submit" disabled={submitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="solid-card mb-5">
                  <div className="p-5">
                    <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">Form Fields</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      {Object.entries(data.formFields).map(([key, field]: any) => (
                        <Field key={key} label={field.label || key} value={field.value || ""} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {!allSelectOptions.length && !data.tables?.length && !Object.keys(data.keyValuePairs || {}).length && !data.formFields && !data.messages && (
                <div className="solid-card mb-5">
                  <EmptyState
                    icon={<Inbox className="w-10 h-10" />}
                    title="No data found"
                    className="py-12"
                  />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
