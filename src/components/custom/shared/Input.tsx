import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-1 ml-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white dark:bg-slate-900 midnight:bg-black",
            "border border-gray-200 dark:border-gray-700 midnight:border-gray-800",
            "rounded-xl px-4 py-2.5",
            "text-gray-900 dark:text-gray-100 midnight:text-gray-100",
            "focus:outline-none focus:border-blue-500/50 transition-colors",
            error && "border-red-500",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-1 ml-1"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white dark:bg-slate-900 midnight:bg-black",
            "border border-gray-200 dark:border-gray-700 midnight:border-gray-800",
            "rounded-xl px-4 py-2",
            "text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100",
            "font-mono focus:outline-none focus:border-blue-500/50 transition-colors resize-none",
            error && "border-red-500",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-1 ml-1"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-white dark:bg-slate-900 midnight:bg-black",
            "border border-gray-200 dark:border-gray-700 midnight:border-gray-800",
            "rounded-xl px-4 py-2.5",
            "text-gray-900 dark:text-gray-100 midnight:text-gray-100",
            "focus:outline-none focus:border-blue-500/50 transition-colors",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";
