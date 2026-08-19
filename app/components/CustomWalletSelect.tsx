"use client";

import React, { useState } from "react";
import { ChevronDown, Check, Zap, Wallet, Building2, AlertCircle, Sparkles } from "lucide-react";

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
    if (w.type === "binance_pay" || w.type === "binance") return "Binance Pay";
    return w.customName || w.title || w.name || "وسيلة دفع مخصصة";
  };

  const getOptionIcon = (type: string) => {
    if (type === "vodafone") return <Wallet className="text-red-400 shrink-0" size={20} />;
    if (type === "instapay") return <Zap className="text-amber-400 fill-amber-400/20 shrink-0" size={20} />;
    if (type === "barq") return <Sparkles className="text-emerald-400 shrink-0" size={20} />;
    if (type === "bank") return <Building2 className="text-cyan-400 shrink-0" size={20} />;
    if (type === "binance_pay" || type === "binance") return <Sparkles className="text-yellow-400 fill-yellow-400/20 shrink-0" size={20} />;
    return <Wallet className="text-primary shrink-0" size={20} />;
  };

  const selectedOption = options.find((w) => w.type === value) || options[0];

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-14 rounded-2xl border border-cyan-500/35 bg-background/95 hover:bg-background/80 px-4 sm:px-5 flex items-center justify-between gap-3 text-right font-bold text-sm sm:text-base outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all shadow-md active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selectedOption ? getOptionIcon(selectedOption.type) : <Wallet size={20} />}
          <span className="truncate text-foreground font-black text-sm sm:text-base">
            {selectedOption ? getOptionLabel(selectedOption) : "اختر وسيلة الإيداع"}
          </span>
          {selectedOption?.disabled && (
            <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full font-bold border border-red-500/30 shrink-0">
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

      {/* Inline Dropdown Menu directly under Trigger Button */}
      {isOpen && (
        <>
          {/* Backdrop to catch clicks outside and close dropdown */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          {/* Absolute Menu Box */}
          <div className="absolute top-full right-0 left-0 mt-2 bg-slate-950/98 border border-cyan-500/40 rounded-2xl p-2.5 shadow-2xl z-50 max-h-80 overflow-y-auto space-y-2 text-right animate-in fade-in slide-in-from-top-2 duration-150 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {options
              .filter((w, idx, self) => self.findIndex((item) => item.type === w.type) === idx)
              .map((w, index) => {
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
                    className={`w-full min-h-[52px] py-3.5 px-4.5 rounded-xl border text-right transition-all flex items-center justify-between gap-3.5 text-sm sm:text-base font-bold cursor-pointer ${
                      w.disabled
                        ? "opacity-40 cursor-not-allowed bg-slate-900/40 border-slate-800/80 text-slate-500"
                        : isSelected
                        ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md font-black"
                        : "bg-slate-900/90 hover:bg-slate-800 border-slate-800 text-slate-100 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {getOptionIcon(w.type)}
                      <span className="font-extrabold truncate text-slate-100 text-sm sm:text-base">
                        {getOptionLabel(w)}
                      </span>
                    </div>

                    {w.disabled ? (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2.5 py-1 rounded-md font-bold border border-red-500/30 flex items-center gap-1 shrink-0">
                        <AlertCircle size={12} /> غير متاح
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
