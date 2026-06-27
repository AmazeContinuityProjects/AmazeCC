import React, { forwardRef } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full pl-9 pr-4 py-2 text-sm",
            "bg-white dark:bg-slate-800 midnight:bg-gray-900",
            "border border-gray-200 dark:border-slate-700 midnight:border-gray-800",
            "rounded-xl",
            "text-gray-900 dark:text-gray-100 midnight:text-gray-100",
            "placeholder-gray-400 dark:placeholder-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "transition-all",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

export default SearchInput;
