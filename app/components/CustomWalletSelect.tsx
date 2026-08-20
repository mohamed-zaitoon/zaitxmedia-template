"use client";

import React, { useState } from "react";
import { ChevronDown, Check, AlertCircle, Wallet } from "lucide-react";
import PaymentMethodLogo from "@/app/components/PaymentLogos";

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
    if (w.type === "vodafone") return "محفظة إلكترونية (فودافون كاش - اتصالات كاش - أورنج كاش - وي باي)";
    if (w.type === "instapay") return "انستاباي (InstaPay)";
    if (w.type === "barq") return "برق (Barq)";
    if (w.type === "bank") return "تحويل بنكي (Bank Transfer)";
    if (w.type === "binance_pay" || w.type === "binance") return "Binance Pay";
    return w.customName || w.title || w.name || "وسيلة دفع مخصصة";
  };

  const getOptionIcon = (type: string) => {
    return <PaymentMethodLogo type={type} size={32} />;
  };

  const selectedOption = options.find((w) => w.type === value) || options[0];

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-h-[60px] rounded-2xl border border-cyan-500/40 bg-background/95 hover:bg-background/80 px-5 flex items-center justify-between gap-4 text-right font-bold outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all shadow-md active:scale-[0.99] cursor-pointer"
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {selectedOption ? getOptionIcon(selectedOption.type) : <Wallet size={24} />}
          <span className="truncate text-foreground font-black text-base sm:text-lg">
            {selectedOption ? getOptionLabel(selectedOption) : "اختر وسيلة الإيداع"}
          </span>
          {selectedOption?.disabled && (
            <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full font-bold border border-red-500/30 shrink-0">
              غير متاح
            </span>
          )}
        </div>
        <div
          className="bg-primary/10 p-2.5 rounded-xl border border-primary/20 text-cyan-400 shrink-0 transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <ChevronDown size={20} />
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
          <div className="absolute top-full right-0 left-0 mt-2 bg-slate-950/98 border border-cyan-500/50 rounded-2xl p-3 shadow-2xl z-50 max-h-96 overflow-y-auto space-y-2.5 text-right animate-in fade-in slide-in-from-top-2 duration-150 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                    className={`w-full min-h-[64px] py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between gap-4 text-base sm:text-lg font-black cursor-pointer ${
                      w.disabled
                        ? "opacity-40 cursor-not-allowed bg-slate-900/40 border-slate-800/80 text-slate-500"
                        : isSelected
                        ? "bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-500/10 scale-[1.01]"
                        : "bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 text-slate-100 hover:border-cyan-500/40"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {getOptionIcon(w.type)}
                      <span className="font-extrabold truncate text-slate-100 text-base sm:text-lg">
                        {getOptionLabel(w)}
                      </span>
                    </div>

                    {w.disabled ? (
                      <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-lg font-bold border border-red-500/30 flex items-center gap-1 shrink-0">
                        <AlertCircle size={14} /> غير متاح
                      </span>
                    ) : isSelected ? (
                      <div className="bg-cyan-500/20 p-2 rounded-full text-cyan-400 border border-cyan-500/40 shrink-0">
                        <Check size={18} />
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
