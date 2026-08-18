// Currency conversion utilities, independent from backend initialization.
// These are pure client-side functions, no backend dependency

export type Currency = "USD" | "EGP" | "SAR";

export interface CurrencySettings {
  baseCurrency: "USD";
  defaultDisplayCurrency: Currency;
  usdToEgp: number;
  usdToSar: number;
  updatedAt: unknown;
  updatedBy: string;
}

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  baseCurrency: "USD",
  defaultDisplayCurrency: "EGP",
  usdToEgp: 50,
  usdToSar: 3.75,
  updatedAt: null,
  updatedBy: "",
};

export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: { usdToEgp: number; usdToSar: number },
): number {
  if (fromCurrency === toCurrency) return amount;
  const amountInUsd =
    fromCurrency === "USD"
      ? amount
      : fromCurrency === "EGP"
        ? amount / rates.usdToEgp
        : amount / rates.usdToSar;
  return toCurrency === "USD"
    ? amountInUsd
    : toCurrency === "EGP"
      ? amountInUsd * rates.usdToEgp
      : amountInUsd * rates.usdToSar;
}

export function formatCurrency(
  amount: number,
  currency: Currency,
  locale: "ar" | "en" = "ar",
  decimals: number = 2,
): string {
  const localeMap = { ar: "ar-EG", en: "en-US" };
  const currencySymbols: Record<Currency, string> = {
    USD: "$",
    EGP: "ج",
    SAR: "ر.س",
  };
  return (
    new Intl.NumberFormat(localeMap[locale], {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount) +
    (currency === "EGP" ? "" : " ") +
    currencySymbols[currency]
  );
}

export function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    USD: "$",
    EGP: "ج",
    SAR: "ر.س",
  };
  return symbols[currency];
}
