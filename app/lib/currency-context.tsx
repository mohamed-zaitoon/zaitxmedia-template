"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { isolateLtr } from "./bidi";

export type Currency = "EGP" | "USD" | "SAR";

export interface CurrencySymbols {
  egp: string;
  sar: string;
  usd: string;
}

export interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (c: Currency) => void;
  convertPrice: (priceEGP: number) => { amount: number; symbol: string; formatted: string };
  rates: { usd: number; sar: number };
  symbols: CurrencySymbols;
  loading: boolean;
}

const defaultSymbols: CurrencySymbols = {
  egp: "£",
  sar: "﷼",
  usd: "$",
};

const CurrencyContext = createContext<CurrencyContextType>({
  selectedCurrency: "EGP",
  setSelectedCurrency: () => {},
  convertPrice: (p) => ({ amount: p, symbol: "£", formatted: p.toFixed(2) + " £" }),
  rates: { usd: 50, sar: 13 },
  symbols: defaultSymbols,
  loading: true,
});

export function ceilTo2Decimals(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  return Math.round(val * 100) / 100;
}

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("USD");
  const [rates, setRates] = useState({ usd: 50, sar: 13 });
  const [symbols, setSymbols] = useState<CurrencySymbols>(defaultSymbols);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The customer can freely choose any supported display currency.
    const saved = localStorage.getItem("selectedCurrency") as Currency;
    if (["EGP", "USD", "SAR"].includes(saved)) {
      setSelectedCurrency(saved);
    }

    const pricingRef = doc(db, "settings", "pricing");

    async function fetchRates() {
      try {
        let usdRate = 50;
        let sarRate = 13;

        // Fetch USD, custom SAR rate, and admin custom currency symbols
        const s = await getDoc(pricingRef);
        if (s.exists()) {
          const d = s.data();
          usdRate = Number(d.usd_rate || d.tiktok_usd_rate || 50);
          if (d.sar_rate_override && Number(d.sar_rate_override) > 0) {
            sarRate = Number(d.sar_rate_override);
          }
          if (d.currency_symbols || d.currencySymbols) {
            const cs = d.currency_symbols || d.currencySymbols;
            setSymbols({
              egp: cs.egp || cs.EGP || "£",
              sar: cs.sar || cs.SAR || "﷼",
              usd: cs.usd || cs.USD || "$",
            });
          }
        }

        if (!sarRate || sarRate === 13) {
          try {
            const res = await fetch("https://api.exchangerate-api.com/v4/latest/SAR");
            const data = await res.json();
            if (data && data.rates && data.rates.EGP) {
              sarRate = data.rates.EGP - 0.75;
            }
          } catch (e) {
            console.error("Failed to fetch SAR rate", e);
          }
        }

        setRates({ usd: usdRate, sar: sarRate });
      } catch (err) {
        console.error("Error fetching rates:", err);
      } finally {
        setLoading(false);
      }
    }

    void fetchRates();
    const unsubscribePricing = onSnapshot(
      pricingRef,
      (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        const usd = Number(data.usd_rate || data.tiktok_usd_rate || 50);
        if (Number.isFinite(usd) && usd > 0) {
          setRates((current) => ({ ...current, usd }));
        }
        if (data.currency_symbols || data.currencySymbols) {
          const cs = data.currency_symbols || data.currencySymbols;
          setSymbols({
            egp: cs.egp || cs.EGP || "£",
            sar: cs.sar || cs.SAR || "﷼",
            usd: cs.usd || cs.USD || "$",
          });
        }
      },
      console.error,
    );
    const ratesInterval = window.setInterval(fetchRates, 30_000);
    const refreshAfterFocus = () => {
      if (document.visibilityState === "visible") void fetchRates();
    };
    window.addEventListener("focus", fetchRates);
    document.addEventListener("visibilitychange", refreshAfterFocus);

    return () => {
      unsubscribePricing();
      window.clearInterval(ratesInterval);
      window.removeEventListener("focus", fetchRates);
      document.removeEventListener("visibilitychange", refreshAfterFocus);
    };
  }, []);

  const changeCurrency = (c: Currency) => {
    setSelectedCurrency(c);
    localStorage.setItem("selectedCurrency", c);
  };

  const convertPrice = (priceEGP: number) => {
    if (selectedCurrency === "USD") {
      const amt = Math.ceil(((priceEGP / rates.usd) - 1e-9) * 100) / 100;
      const sym = symbols.usd || "$";
      return { amount: amt, symbol: sym, formatted: isolateLtr(`${sym}${amt.toFixed(2)}`) };
    } else if (selectedCurrency === "SAR") {
      const amt = Math.ceil(((priceEGP / rates.sar) - 1e-9) * 100) / 100;
      const sym = symbols.sar || "﷼";
      return { amount: amt, symbol: sym, formatted: isolateLtr(`${amt.toFixed(2)} ${sym}`) };
    }
    const roundedEgp = Math.ceil((priceEGP - 1e-9) * 100) / 100;
    const sym = symbols.egp || "£";
    return { amount: roundedEgp, symbol: sym, formatted: isolateLtr(`${roundedEgp.toFixed(2)} ${sym}`) };
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency: changeCurrency, convertPrice, rates, symbols, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
