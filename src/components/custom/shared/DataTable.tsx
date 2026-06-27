import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  className?: string;
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, any>[];
  caption?: string;
  className?: string;
  emptyMessage?: string;
}

export default function DataTable({
  columns,
  data,
  caption,
  className,
  emptyMessage = "No data available",
}: DataTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className={cn("glass-card", className)}>
        <div className="p-5">
          {caption && (
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-4">
              {caption}
            </h4>
          )}
          <p className="text-sm text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center py-4">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("glass-card", className)}>
      <div className="p-5">
        {caption && (
          <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-4">
            {caption}
          </h4>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 midnight:border-gray-700">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider whitespace-nowrap",
                      col.className
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800 last:border-0 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "py-2.5 px-2 text-gray-800 dark:text-gray-200 midnight:text-gray-200",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
