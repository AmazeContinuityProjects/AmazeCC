"use client";

import { useEffect, useState, type ElementType } from "react";
import { Check } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { ListRowText, ListShell } from "./Surfaces";

export interface ExperienceModeOption<T extends string = string> {
  value: T;
  title: string;
  description: string;
  badge?: string;
  Icon: ElementType;
  iconClass?: string;
  selectedClass?: string;
  activeColor?: string;
}

export interface ExperienceModePickerModalProps<T extends string = string> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerIcon?: ElementType;
  options: readonly ExperienceModeOption<T>[];
  currentMode: T;
  onSelectMode: (mode: T, remember: boolean) => void;
  overlayId: string;
  rememberLabel?: string;
  applyLabel?: string | ((selectedMode: T, selectedOption?: ExperienceModeOption<T>) => string);
  maxWidth?: string;
  panelZIndex?: number;
  backdropZIndex?: number;
}

/**
 * Shared modal for choosing an app or tab experience layout (e.g., Guided vs Modern vs Classic, or Modern vs Classic).
 *
 * Eliminates duplicate boilerplate across FFCSLayoutModeModal and FFCSGeneratorViewModeModal.
 * When UX, animations, or modal styling changes, it automatically updates everywhere.
 */
export default function ExperienceModePickerModal<T extends string = string>({
  isOpen,
  onClose,
  title,
  subtitle,
  headerIcon: HeaderIcon,
  options,
  currentMode,
  onSelectMode,
  overlayId,
  rememberLabel = "Remember my preference for future visits",
  applyLabel = "Apply & Continue",
  maxWidth = "max-w-2xl",
  panelZIndex = 350,
  backdropZIndex = 345,
}: ExperienceModePickerModalProps<T>) {
  const [selected, setSelected] = useState<T>(currentMode);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (isOpen) setSelected(currentMode);
  }, [isOpen, currentMode]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSelectMode(selected, remember);
    onClose();
  };

  const selectedOpt = options.find((o) => o.value === selected);
  const activeColor = selectedOpt?.activeColor || "bg-indigo-600 hover:bg-indigo-500";
  const buttonText = typeof applyLabel === "function" ? applyLabel(selected, selectedOpt) : applyLabel;

  return (
    <BottomSheet
      onClose={onClose}
      overlayId={overlayId}
      maxWidth={maxWidth}
      panelZIndex={panelZIndex}
      backdropZIndex={backdropZIndex}
      contentClassName="space-y-5"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border-strong/60 pb-4">
        <div className="flex items-center gap-3">
          {HeaderIcon ? (
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
              <HeaderIcon className="w-5 h-5" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-xl font-black text-text-heading tracking-tight leading-tight">{title}</h2>
            {subtitle ? <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{subtitle}</p> : null}
          </div>
        </div>
      </div>

      <div role="radiogroup" aria-label={title}>
        <ListShell>
          {options.map((option) => {
            const isSelected = selected === option.value;
            const IconComponent = option.Icon;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(option.value)}
                className={`w-full flex items-center gap-3 p-3.5 sm:p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                  isSelected ? (option.selectedClass ?? "bg-indigo-500/5") : "hover:bg-surface-secondary/60"
                }`}
              >
                <span
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                    option.iconClass ?? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                </span>
                <ListRowText title={option.title} titleTag="span" subtitle={option.description} />
                {option.badge ? (
                  <span className="hidden sm:inline-flex text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-surface-secondary text-muted-foreground border border-border-strong/60 shrink-0">
                    {option.badge}
                  </span>
                ) : null}
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-border-strong text-transparent"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              </button>
            );
          })}
        </ListShell>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border-strong/50">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
          />
          <span>{rememberLabel}</span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/80 border border-border-strong/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${activeColor}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
