"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Sparkles, X, Search } from "lucide-react";

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}

interface GenericCustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  title?: string;
  className?: string;
  searchable?: boolean;
}

export default function GenericCustomSelect({
  value,
  onChange,
  options,
  placeholder = "اختر من القائمة",
  title = "اختر الخيار المناسب",
  className = "",
  searchable = false,
}: GenericCustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable && searchQuery.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : options;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 rounded-2xl border border-cyan-500/30 bg-background/95 hover:bg-background/80 px-5 flex items-center justify-between gap-3 text-right font-bold text-base outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all shadow-md active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedOption?.icon}
          <span className="truncate text-foreground font-black text-sm md:text-base">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-bold border border-cyan-500/30 shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <div
          className="bg-primary/10 p-2 rounded-xl border border-primary/20 text-cyan-400 shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown size={18} />
        </div>
      </button>

      {/* Floating Centered Modal Menu */}
      {isOpen && (
        <>
          {/* Backdrop Overlay (100% Transparent) */}
          <div
            className="fixed inset-0 bg-transparent z-[99998] transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
          />

          {/* Centered Modal Sheet Container */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-md bg-slate-950/98 border border-cyan-500/40 rounded-3xl p-5 shadow-2xl z-[99999] max-h-[85vh] overflow-y-auto space-y-2.5 text-right animate-in zoom-in-95 fade-in duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-cyan-400 animate-pulse" />
                <span className="text-sm font-black text-slate-100">{title}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                aria-label="إغلاق"
              >
                <X size={16} />
              </button>
            </div>

            {/* Optional Search Bar */}
            {searchable && options.length > 5 && (
              <div className="relative mb-3">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث هنا..."
                  className="w-full h-11 pr-10 pl-4 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-bold text-slate-100 outline-none focus:border-cyan-400 transition-all"
                />
              </div>
            )}

            {/* List of Custom Options */}
            {filteredOptions.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400">
                لا توجد نتائج مطابقة
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setIsOpen(false);
                      }
                    }}
                    className={`w-full min-h-[56px] py-3.5 px-4 rounded-2xl border text-right transition-all flex items-center justify-between gap-3 text-sm font-black cursor-pointer ${
                      opt.disabled
                        ? "opacity-40 cursor-not-allowed bg-slate-900/40 border-slate-800 text-slate-500"
                        : isSelected
                        ? "bg-gradient-to-r from-cyan-500/20 via-primary/15 to-transparent border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10 scale-[1.01]"
                        : "bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-200 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {opt.icon}
                      <span className="font-extrabold text-sm truncate text-slate-100">
                        {opt.label}
                      </span>
                    </div>

                    {opt.badge ? (
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2.5 py-1 rounded-lg font-bold border border-cyan-500/30 shrink-0">
                        {opt.badge}
                      </span>
                    ) : isSelected ? (
                      <div className="bg-cyan-500/20 p-1.5 rounded-full text-cyan-400 border border-cyan-500/40 shrink-0">
                        <Check size={16} />
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
