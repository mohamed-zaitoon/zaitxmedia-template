"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Zap, Wallet, Building2, AlertCircle, Sparkles, X } from "lucide-react";

export interface WalletOption {
  type: string;
  disabled?: boolean;
  customName?: string;
  title?: string;
  name?: string;
  number?: string;
  link?: string;
}

interface CustomWalletSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: WalletOption[];
}

export default function CustomWalletSelect({ value, onChange, options }: CustomWalletSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getOptionLabel = (w: WalletOption) => {
    if (w.type === "vodafone") return "فودافون كاش / محفظه الكترونية";
    if (w.type === "instapay") return "انستاباي (InstaPay)";
    if (w.type === "barq") return "برق (Barq)";
    if (w.type === "bank") return "تحويل بنكي (Bank Transfer)";
    return w.customName || w.title || w.name || "وسيلة دفع مخصصة";
  };

  const getOptionIcon = (type: string) => {
    if (type === "vodafone") return <Wallet className="text-red-400 shrink-0" size={20} />;
    if (type === "instapay") return <Zap className="text-amber-400 fill-amber-400/20 shrink-0" size={20} />;
    if (type === "barq") return <Sparkles className="text-emerald-400 shrink-0" size={20} />;
    if (type === "bank") return <Building2 className="text-cyan-400 shrink-0" size={20} />;
    return <Wallet className="text-primary shrink-0" size={20} />;
  };

  const selectedOption = options.find((w) => w.type === value) || options[0];

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 rounded-2xl border border-cyan-500/30 bg-background/95 hover:bg-background/80 px-5 flex items-center justify-between gap-3 text-right font-bold text-base outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all shadow-md active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedOption ? getOptionIcon(selectedOption.type) : <Wallet size={20} />}
          <span className="truncate text-foreground font-black text-sm md:text-base">
            {selectedOption ? getOptionLabel(selectedOption) : "اختر وسيلة الإيداع"}
          </span>
          {selectedOption?.disabled && (
            <span className="text-[10px] bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full font-bold border border-red-500/30 shrink-0">
              غير متاح
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
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-md bg-slate-950/98 border border-cyan-500/40 rounded-3xl p-6 shadow-2xl z-[99999] max-h-[85vh] overflow-y-auto space-y-3 text-right animate-in zoom-in-95 fade-in duration-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-cyan-400 animate-pulse" />
                <span className="text-base font-black text-slate-100">اختر وسيلة الإيداع</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            {/* List of Custom Options */}
            {options.map((w, index) => {
              const isSelected = w.type === value;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={w.disabled}
                  onClick={() => {
                    if (!w.disabled) {
                      onChange(w.type);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full min-h-[58px] py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between gap-4 text-sm font-black cursor-pointer ${
                    w.disabled
                      ? "opacity-40 cursor-not-allowed bg-slate-900/40 border-slate-800 text-slate-500"
                      : isSelected
                      ? "bg-gradient-to-r from-cyan-500/20 via-primary/15 to-transparent border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/10 scale-[1.01]"
                      : "bg-slate-900/80 hover:bg-slate-900 border-slate-800 text-slate-200 hover:border-cyan-500/40"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1 px-1">
                    {getOptionIcon(w.type)}
                    <span className="font-extrabold text-sm md:text-base truncate text-slate-100">
                      {getOptionLabel(w)}
                    </span>
                  </div>

                  {w.disabled ? (
                    <span className="text-[10px] bg-red-500/20 text-red-400 px-2.5 py-1 rounded-lg font-bold border border-red-500/30 flex items-center gap-1 shrink-0">
                      <AlertCircle size={11} /> غير متاح
                    </span>
                  ) : isSelected ? (
                    <div className="bg-cyan-500/20 p-1.5 rounded-full text-cyan-400 border border-cyan-500/40 shrink-0">
                      <Check size={16} />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
