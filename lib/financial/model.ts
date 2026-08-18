import { FieldValue } from "firebase-admin/firestore";

export const FINANCIAL_CURRENCIES = ["USD", "EGP", "SAR"] as const;
export type FinancialCurrency = (typeof FINANCIAL_CURRENCIES)[number];

export const ASSET_TYPES = ["Exchange", "Wallet", "Bank", "Cash", "Other"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export function isFinancialCurrency(value: unknown): value is FinancialCurrency {
  return FINANCIAL_CURRENCIES.includes(String(value) as FinancialCurrency);
}

export function isAssetType(value: unknown): value is AssetType {
  return ASSET_TYPES.includes(String(value) as AssetType);
}

export function money(value: unknown, precision = 6): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(precision));
}

export function profileBalances(profile: Record<string, unknown>) {
  const stored =
    profile.balances && typeof profile.balances === "object"
      ? profile.balances as Record<string, unknown>
      : {};
  return {
    USD: money(stored.USD ?? profile.balance),
    EGP: money(stored.EGP),
    SAR: money(stored.SAR),
  };
}

export function ledgerRecord(input: {
  type: string;
  currency: FinancialCurrency;
  amount: number;
  direction: "debit" | "credit";
  account: string;
  counterpartyAccount?: string;
  userId?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  description: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}) {
  return {
    ...input,
    amount: money(input.amount),
    immutable: true,
    schemaVersion: 2,
    createdAt: FieldValue.serverTimestamp(),
  };
}

export function auditRecord(input: {
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  adminId: string;
  adminEmail?: string;
  description?: string;
}) {
  return {
    ...input,
    immutable: true,
    schemaVersion: 2,
    createdAt: FieldValue.serverTimestamp(),
  };
}
