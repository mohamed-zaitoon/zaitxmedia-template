"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, Users, DollarSign, Package, ArrowUpDown,
  Search, Building2, BookOpen, FileText, Plus, X, ChevronUp, ChevronDown,
  ArrowUpRight, ArrowDownRight, Minus, Eye, Filter,
} from "lucide-react";
import GenericCustomSelect from "../components/GenericCustomSelect";

// ─── Types ───────────────────────────────────────────────────────────────────
type Currency = "USD" | "EGP" | "SAR";
const CUR_SYMBOL: Record<Currency, string> = { USD: "$", EGP: "EGP", SAR: "SAR" };

function n(v: any) { return Number(v) || 0; }
function ceilTo2Decimals(val: number): number {
  if (!Number.isFinite(val) || val <= 0) return 0;
  const normalized = Math.round(val * 1e8) / 1e8;
  return Math.ceil(normalized * 100 - 1e-9) / 100;
}

function fmtNum(num: number, decimals = 2) {
  return ceilTo2Decimals(num).toString();
}
function fmt(num: number, cur: Currency, decimals = 2) {
  return `${fmtNum(num, decimals)} ${CUR_SYMBOL[cur]}`;
}
function fmtUsd(num: number) { return `$${fmtNum(num)}`; }
function pctLabel(pct: number) {
  const abs = Math.abs(pct);
  if (pct > 0) return { text: `+${abs}%`, color: "#10b981", Icon: ArrowUpRight };
  if (pct < 0) return { text: `-${abs}%`, color: "#ef4444", Icon: ArrowDownRight };
  return { text: "0%", color: "#6b7280", Icon: Minus };
}

// ─── Shared UI ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = "#38bdf8", change, note }: {
  label: string; value: string; sub?: string; color?: string;
  change?: number; note?: string;
}) {
  const ch = change !== undefined ? pctLabel(change) : null;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0b1120] p-5 flex flex-col gap-2 hover:border-white/10 transition-colors">
      <div className="text-xs text-muted-foreground font-semibold tracking-wide uppercase">{label}</div>
      <div className="font-mono text-2xl font-black" style={{ color }}>{value}</div>
      <div className="flex items-center gap-3 mt-auto flex-wrap">
        {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        {ch && (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold rounded-full px-2 py-0.5"
            style={{ background: ch.color + "18", color: ch.color }}>
            <ch.Icon size={11} /> {ch.text} هذا الشهر
          </span>
        )}
      </div>
      {note && <div className="text-[10px] text-muted-foreground/60 border-t border-white/5 pt-2 mt-1">{note}</div>}
    </div>
  );
}

function SectionNav({ sections, active, onChange }: {
  sections: { id: string; label: string; icon: React.ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap mb-5">
      {sections.map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
            active === s.id
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-transparent text-muted-foreground border-border/40 hover:bg-white/5 hover:text-white"
          }`}
        >
          {s.icon} {s.label}
        </button>
      ))}
    </div>
  );
}

function DataTable({ cols, rows, empty = "لا توجد بيانات" }: {
  cols: string[]; rows: React.ReactNode[][]; empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <table className="w-full min-w-[640px] border-collapse text-sm text-right">
        <thead className="bg-black/20">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-4 py-3 text-muted-foreground text-xs font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols.length} className="text-center py-10 text-muted-foreground text-sm">
                {empty}
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-t border-border/30 hover:bg-white/[0.02] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: "#10b981", text: "#10b981", label: "مكتمل" },
    approved: { bg: "#10b981", text: "#10b981", label: "معتمد" },
    verified: { bg: "#10b981", text: "#10b981", label: "تأكيد SMS" },
    pending: { bg: "#f59e0b", text: "#f59e0b", label: "قيد التنفيذ" },
    pending_action: { bg: "#f59e0b", text: "#f59e0b", label: "بانتظار إجراء" },
    processing: { bg: "#38bdf8", text: "#38bdf8", label: "جاري التنفيذ" },
    rejected: { bg: "#ef4444", text: "#ef4444", label: "مرفوض" },
    cancelled: { bg: "#6b7280", text: "#6b7280", label: "ملغى" },
    refunded: { bg: "#a78bfa", text: "#a78bfa", label: "مسترد" },
  };
  const s = map[status] || { bg: "#6b7280", text: "#aaa", label: status };
  return (
    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold"
      style={{ background: s.bg + "20", color: s.text }}>
      {s.label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function FinancialTab() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [assetTotals, setAssetTotals] = useState<any>({ USD: 0, EGP: 0, SAR: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [profits, setProfits] = useState<any>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [assetForm, setAssetForm] = useState({
    name: "", type: "Exchange", currency: "USD", balance: "", notes: "",
  });
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [sortCustomers, setSortCustomers] = useState<"balance" | "name">("balance");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [custDateFrom, setCustDateFrom] = useState("");
  const [custDateTo, setCustDateTo] = useState("");

  const opts: RequestInit = { credentials: "include", cache: "no-store" };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, ord, dep, cust, tx, pr, ast, led] = await Promise.all([
        fetch("/api/v1/financial/dashboard", opts).then(r => r.json()),
        fetch("/api/v1/financial/orders?limit=200", opts).then(r => r.json()),
        fetch("/api/v1/financial/deposits?limit=200", opts).then(r => r.json()),
        fetch("/api/v1/financial/customers?limit=200", opts).then(r => r.json()),
        fetch("/api/v1/financial/transactions?limit=200", opts).then(r => r.json()),
        fetch(`/api/v1/financial/profits?period=${period}`, opts).then(r => r.json()),
        fetch("/api/v1/financial/assets?limit=100", opts).then(r => r.json()),
        fetch("/api/v1/financial/ledger?limit=200", opts).then(r => r.json()),
      ]);
      if (ov.success) setOverview(ov);
      if (ord.success) setOrders(ord.data || []);
      if (dep.success) setDeposits(dep.data || []);
      if (cust.success) setCustomers(cust.data || []);
      if (tx.success) setTransactions(tx.data || []);
      if (pr.success) setProfits(pr);
      if (ast.success) { setAssets(ast.data || []); setAssetTotals(ast.totals || {}); }
      if (led.success) setLedger(led.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sections = [
    { id: "overview", label: "لوحة المالية", icon: <TrendingUp size={14} /> },
    { id: "customers", label: "أرصدة العملاء", icon: <Users size={14} /> },
    { id: "orders", label: "الطلبات", icon: <Package size={14} /> },
    { id: "deposits", label: "الإيداعات", icon: <DollarSign size={14} /> },
    { id: "profits", label: "الأرباح", icon: <TrendingUp size={14} /> },
    { id: "transactions", label: "حركات المحافظ", icon: <ArrowUpDown size={14} /> },
    { id: "assets", label: "الأصول", icon: <Building2 size={14} /> },
    { id: "ledger", label: "دفتر الأستاذ", icon: <BookOpen size={14} /> },
    { id: "reports", label: "التقارير", icon: <FileText size={14} /> },
  ];

  // Sorted & filtered customers
  const filteredCustomers = customers
    .filter(c =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.id?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortCustomers === "balance") {
        const diff = (b.balances?.USD?.total || 0) - (a.balances?.USD?.total || 0);
        return sortDir === "desc" ? diff : -diff;
      }
      const diff = (a.name || "").localeCompare(b.name || "");
      return sortDir === "desc" ? diff : -diff;
    });

  const totalCustomersBalanceUsd = customers.reduce((sum, c) => sum + n(c.balances?.USD?.total), 0);
  const topCustomerBalanceUsd = customers[0]?.balances?.USD?.total || 0;
  const usdRate = n(overview?.exchangeRates?.usdToEgp) || 50;

  const openCustomer = async (id: string) => {
    setCustomerLoading(true);
    const params = new URLSearchParams();
    if (custDateFrom) params.set("dateFrom", custDateFrom);
    if (custDateTo) params.set("dateTo", `${custDateTo}T23:59:59`);
    const res = await fetch(`/api/v1/financial/customers/${id}?${params}`, opts);
    const result = await res.json();
    if (res.ok && result.success) setSelectedCustomer(result);
    setCustomerLoading(false);
  };

  const saveAsset = async () => {
    const res = await fetch("/api/v1/financial/assets", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...assetForm, balance: Number(assetForm.balance) }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return alert(result.error || "تعذر حفظ الأصل");
    setAssetForm({ name: "", type: "Exchange", currency: "USD", balance: "", notes: "" });
    await fetchAll();
  };

  const editAssetBalance = async (asset: any) => {
    const input = window.prompt(`الرصيد الجديد لـ ${asset.name} (${asset.currency})`, String(asset.balance));
    if (input === null) return;
    const balance = Number(input);
    if (!Number.isFinite(balance) || balance < 0) return alert("الرصيد غير صحيح");
    const reason = window.prompt("سبب التعديل", "تسوية رصيد فعلية") || "";
    const res = await fetch(`/api/v1/financial/assets/${asset.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance, reason }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return alert(result.error || "تعذر تعديل الأصل");
    await fetchAll();
  };

  const exportLedger = (format: "csv" | "xls") => {
    const rows = [
      ["Date", "Type", "Direction", "Currency", "Amount", "Account", "Reference", "Description"],
      ...ledger.map(e => [
        e.createdAt || "", e.type, e.direction, e.currency,
        e.amount, e.account, e.referenceId || "", e.description || "",
      ]),
    ];
    const content = format === "csv"
      ? rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
      : `<table>${rows.map(r => `<tr>${r.map(c => `<td>${String(c)}</td>`).join("")}</tr>`).join("")}</table>`;
    const blob = new Blob([`\uFEFF${content}`], {
      type: format === "csv" ? "text/csv;charset=utf-8" : "application/vnd.ms-excel",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ledger-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadCustomReport = async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (reportFrom) params.set("dateFrom", reportFrom);
    if (reportTo) params.set("dateTo", `${reportTo}T23:59:59.999`);
    const [lr, pr] = await Promise.all([
      fetch(`/api/v1/financial/ledger?${params}`, opts),
      fetch(`/api/v1/financial/profits?period=custom&dateFrom=${encodeURIComponent(reportFrom)}&dateTo=${encodeURIComponent(reportTo)}`, opts),
    ]);
    const ld = await lr.json();
    const pd = await pr.json();
    if (ld.success) setLedger(ld.data || []);
    if (pd.success) setProfits(pd);
  };

  const runMigration = async () => {
    const prev = await fetch("/api/admin/financial/migrate", opts);
    const pv = await prev.json();
    if (!prev.ok) return alert(pv.error || "تعذرت معاينة الترحيل");
    const summary = Object.entries(pv.counts || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
    if (!window.confirm(`ترحيل مالي غير هدّام.\n${summary}\n\nهل تريد المتابعة؟`)) return;
    const res = await fetch("/api/admin/financial/migrate", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "MIGRATE_FINANCIAL_V2" }),
    });
    const result = await res.json();
    if (!res.ok) return alert(result.error || "فشل الترحيل");
    alert(`تم الترحيل:\n${JSON.stringify(result.migrated, null, 2)}`);
    await fetchAll();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
      <RefreshCw size={28} className="animate-spin" />
      <div className="text-sm">جاري تحميل البيانات المالية...</div>
    </div>
  );

  return (
    <div className="w-full" dir="rtl">
      <SectionNav sections={sections} active={activeSection} onChange={setActiveSection} />

      {/* Refresh button */}
      <div className="flex justify-end mb-4">
        <button onClick={fetchAll}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white bg-white/5 hover:bg-white/10 border border-border px-3 py-1.5 rounded-lg transition-all">
          <RefreshCw size={12} /> تحديث البيانات
        </button>
      </div>

      {/* ══════════════════════════════════════════════════ */}
      {/* OVERVIEW */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "overview" && overview && (
        <div className="flex flex-col gap-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="إجمالي أرصدة العملاء"
              value={fmtUsd(n(overview.customerBalances?.USD))}
              sub={`≈ ${fmt(n(overview.customerBalances?.USD) * usdRate, "EGP", 0)}`}
              color="#f59e0b"
              note={`${n(overview.customersCount)} عميل نشط`}
            />
            <KpiCard
              label="أرباح الطلبات — هذا الشهر"
              value={fmtUsd(n(overview.thisMonth?.orders?.profitUsd))}
              sub={`الإجمالي الكلي: ${fmtUsd(n(overview.ordersProfit?.USD))}`}
              color="#10b981"
              change={overview.monthlyChange?.ordersProfitUsd}
            />
            <KpiCard
              label="رسوم الإيداعات — هذا الشهر"
              value={fmt(n(overview.thisMonth?.deposits?.profitEgp), "EGP")}
              sub={`الإجمالي الكلي: ${fmt(n(overview.depositProfit?.EGP), "EGP")}`}
              color="#38bdf8"
              change={overview.monthlyChange?.depositsProfitEgp}
            />
            <KpiCard
              label="أموال الشركة الصافية"
              value={fmtUsd(n(overview.companyFunds?.USD))}
              sub={`EGP: ${fmt(n(overview.companyFunds?.EGP), "EGP", 0)}`}
              color="#10b981"
              note="الأصول − أرصدة العملاء"
            />
          </div>

          {/* Monthly comparison */}
          <div className="rounded-2xl border border-border/40 bg-[#0b1120] p-5">
            <div className="text-sm font-bold text-foreground mb-4">📅 مقارنة شهرية — هذا الشهر vs الشهر الماضي</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  label: "طلبات منجزة",
                  current: overview.thisMonth?.orders?.count,
                  prev: overview.lastMonth?.orders?.count,
                  pct: overview.monthlyChange?.ordersCount,
                  fmt: (v: number) => String(v),
                },
                {
                  label: "ربح الطلبات",
                  current: overview.thisMonth?.orders?.profitUsd,
                  prev: overview.lastMonth?.orders?.profitUsd,
                  pct: overview.monthlyChange?.ordersProfitUsd,
                  fmt: (v: number) => fmtUsd(v),
                },
                {
                  label: "إيداعات مؤكدة",
                  current: overview.thisMonth?.deposits?.count,
                  prev: overview.lastMonth?.deposits?.count,
                  pct: overview.monthlyChange?.depositsCount,
                  fmt: (v: number) => String(v),
                },
                {
                  label: "رسوم الإيداعات",
                  current: overview.thisMonth?.deposits?.profitEgp,
                  prev: overview.lastMonth?.deposits?.profitEgp,
                  pct: overview.monthlyChange?.depositsProfitEgp,
                  fmt: (v: number) => fmt(v, "EGP"),
                },
                {
                  label: "إجمالي الإيداعات (EGP)",
                  current: overview.thisMonth?.deposits?.paidEgp,
                  prev: overview.lastMonth?.deposits?.paidEgp,
                  pct: overview.monthlyChange?.depositsCreditedUsd,
                  fmt: (v: number) => fmt(v, "EGP", 0),
                },
                {
                  label: "رصيد تم شحنه للعملاء",
                  current: overview.thisMonth?.deposits?.creditedUsd,
                  prev: overview.lastMonth?.deposits?.creditedUsd,
                  pct: overview.monthlyChange?.depositsCreditedUsd,
                  fmt: (v: number) => fmtUsd(v),
                },
              ].map(({ label, current, prev, pct, fmt: fmtFn }) => {
                const { text, color, Icon } = pctLabel(n(pct));
                return (
                  <div key={label} className="bg-black/20 rounded-xl p-4">
                    <div className="text-xs text-muted-foreground mb-2">{label}</div>
                    <div className="font-mono font-bold text-lg text-foreground">{fmtFn(n(current))}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground/60">الماضي: {fmtFn(n(prev))}</span>
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold rounded px-1.5 py-0.5"
                        style={{ background: color + "18", color }}>
                        <Icon size={10} /> {text}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Accounting equation */}
          <div className="rounded-2xl border border-border/40 bg-[#0b1120] p-5">
            <div className="text-sm font-bold text-foreground mb-4">⚖️ المعادلة المحاسبية — الأصول = أرصدة العملاء + أموال الشركة</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="pb-3 pr-2">العملة</th>
                    <th className="pb-3">إجمالي الأصول</th>
                    <th className="pb-3">أرصدة العملاء</th>
                    <th className="pb-3 text-emerald-400">أموال الشركة</th>
                  </tr>
                </thead>
                <tbody>
                  {(["USD", "EGP", "SAR"] as Currency[]).map(cur => (
                    <tr key={cur} className="border-t border-border/30">
                      <td className="py-3 pr-2 font-bold text-muted-foreground">{cur}</td>
                      <td className="py-3 font-mono">{fmt(n(overview.totalAssets?.[cur]), cur)}</td>
                      <td className="py-3 font-mono text-amber-400">{fmt(n(overview.customerBalances?.[cur]), cur)}</td>
                      <td className="py-3 font-mono font-bold text-emerald-400">{fmt(n(overview.companyFunds?.[cur]), cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="إجمالي الطلبات" value={String(n(overview.orders?.totalCount))} color="#e2e8f0" />
            <KpiCard label="طلبات معلقة" value={String(n(overview.orders?.pendingCount))} color="#f59e0b" />
            <KpiCard label="إجمالي المبيعات" value={fmtUsd(n(overview.orders?.sales?.USD))} color="#38bdf8" />
            <KpiCard label="تكاليف الموردين" value={fmtUsd(n(overview.orders?.supplierCosts?.USD))} color="#ef4444" />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* CUSTOMERS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "customers" && (
        <div className="flex flex-col gap-4">
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="إجمالي العملاء" value={String(customers.length)} color="#e2e8f0" />
            <KpiCard
              label="إجمالي أرصدة العملاء"
              value={fmtUsd(totalCustomersBalanceUsd)}
              sub={`≈ ${fmt(totalCustomersBalanceUsd * usdRate, "EGP", 0)}`}
              color="#f59e0b"
            />
            <KpiCard
              label="أعلى رصيد"
              value={fmtUsd(topCustomerBalanceUsd)}
              sub={customers[0]?.name || "—"}
              color="#38bdf8"
            />
          </div>

          {/* Search & Sort */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو الإيميل أو المعرف..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-black/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40"
              />
            </div>
            <button
              onClick={() => { setSortCustomers("balance"); setSortDir(d => d === "desc" ? "asc" : "desc"); }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                sortCustomers === "balance" ? "bg-primary/15 text-primary border-primary/30" : "bg-white/5 border-border text-muted-foreground"
              }`}
            >
              {sortDir === "desc" ? <ChevronDown size={13} /> : <ChevronUp size={13} />} ترتيب بالرصيد
            </button>
          </div>

          {/* Customers Table */}
          <DataTable
            cols={["العميل", "الدولة", "الرصيد (USD)", "المكافئ (EGP)", "المكافئ (SAR)", "كشف الحساب"]}
            rows={filteredCustomers.map(c => [
              <div key="name">
                <div className="font-semibold text-sm">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.email}</div>
              </div>,
              <span key="country" className="text-sm">{c.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"}</span>,
              <span key="usd" className="font-mono font-bold text-amber-400">{fmtUsd(n(c.balances?.USD?.total))}</span>,
              <span key="egp" className="font-mono text-sm">{fmt(n(c.balances?.EGP?.total), "EGP")}</span>,
              <span key="sar" className="font-mono text-sm text-purple-400">{fmt(n(c.balances?.SAR?.total), "SAR")}</span>,
              <button key="btn" onClick={() => openCustomer(c.id)}
                className="inline-flex items-center gap-1 bg-white/5 hover:bg-primary/10 hover:text-primary text-muted-foreground border border-border hover:border-primary/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                <Eye size={12} /> فتح الكشف
              </button>,
            ])}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ORDERS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "orders" && (
        <div className="flex flex-col gap-4">
          {/* Totals row */}
          {orders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="عدد الطلبات" value={String(orders.length)} color="#e2e8f0" />
              <KpiCard label="إجمالي المبيعات" value={fmtUsd(orders.reduce((s, o) => s + n(o.saleAmountUsd), 0))} color="#38bdf8" />
              <KpiCard label="إجمالي التكاليف" value={fmtUsd(orders.reduce((s, o) => s + n(o.supplierCostUsd), 0))} color="#ef4444" />
              <KpiCard label="إجمالي الأرباح" value={fmtUsd(orders.reduce((s, o) => s + n(o.netProfitUsd), 0))} color="#10b981" />
            </div>
          )}
          <DataTable
            cols={["#", "العميل", "الخدمة", "الكمية", "سعر البيع", "التكلفة", "الربح", "الهامش%", "الحالة", "التاريخ"]}
            rows={orders.map((o, idx) => {
              const margin = n(o.saleAmountUsd) > 0
                ? Math.round((n(o.netProfitUsd) / n(o.saleAmountUsd)) * 100)
                : 0;
              return [
                <span key="i" className="text-muted-foreground text-xs font-mono">{idx + 1}</span>,
                <span key="u" className="text-sm">{o.userName || "—"}</span>,
                <span key="s" className="text-sm max-w-[140px] truncate block">{o.serviceName || "—"}</span>,
                <span key="q" className="font-mono">{n(o.quantity) || 1}</span>,
                <span key="sale" className="font-mono text-primary font-bold">{fmtUsd(n(o.saleAmountUsd))}</span>,
                <span key="cost" className="font-mono text-red-400">{fmtUsd(n(o.supplierCostUsd))}</span>,
                <span key="prof" className="font-mono font-bold text-emerald-400">{fmtUsd(n(o.netProfitUsd))}</span>,
                <span key="margin" className={`text-xs font-bold ${margin >= 20 ? "text-emerald-400" : margin >= 10 ? "text-amber-400" : "text-red-400"}`}>
                  {margin}%
                </span>,
                <StatusBadge key="st" status={o.status} />,
                <span key="d" className="text-xs text-muted-foreground whitespace-nowrap">
                  {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-US") : "—"}
                </span>,
              ];
            })}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* DEPOSITS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "deposits" && (
        <div className="flex flex-col gap-4">
          {deposits.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard label="عدد الإيداعات" value={String(deposits.length)} color="#e2e8f0" />
              <KpiCard label="إجمالي مدفوع (EGP)" value={fmt(deposits.reduce((s, d) => s + n(d.customerPaidAmount), 0), "EGP", 0)} color="#38bdf8" />
              <KpiCard label="إجمالي رسوم (EGP)" value={fmt(deposits.reduce((s, d) => s + n(d.chargedFeeAmount), 0), "EGP")} color="#f59e0b" />
              <KpiCard label="إجمالي رصيد مُضاف" value={fmtUsd(deposits.reduce((s, d) => s + n(d.creditedUsd), 0))} color="#10b981" />
            </div>
          )}
          <DataTable
            cols={["المعرف", "العميل", "الوسيلة", "المدفوع", "المضاف (USD)", "الرسوم", "الربح", "الحالة"]}
            rows={deposits.map(d => [
              <span key="id" className="font-mono text-[11px] text-muted-foreground">{d.id?.slice(0, 8)}</span>,
              <span key="u" className="text-sm">{d.userEmail || "—"}</span>,
              <span key="m" className="bg-white/5 border border-border px-2 py-0.5 rounded text-xs">{d.paymentMethod}</span>,
              <span key="paid" className="font-mono">{n(d.customerPaidAmount).toFixed(2)} {d.currency === "SAR" ? "ر.س" : "ج.م"}</span>,
              <span key="cr" className="font-mono text-primary font-bold">{fmtUsd(n(d.creditedUsd))}</span>,
              <span key="fee" className="font-mono text-emerald-400">{n(d.chargedFeeAmount).toFixed(2)} ج.م</span>,
              <span key="profit" className="font-mono font-bold text-emerald-400">{n(d.netDepositProfit).toFixed(2)}</span>,
              <StatusBadge key="st" status={d.status} />,
            ])}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* PROFITS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "profits" && (
        <div className="flex flex-col gap-4">
          {/* Period selector */}
          <div className="flex gap-2 flex-wrap">
            {[["all", "كل الوقت"], ["today", "اليوم"], ["week", "هذا الأسبوع"], ["month", "هذا الشهر"], ["year", "هذه السنة"]].map(([v, l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  period === v ? "bg-primary/15 text-primary border-primary/30" : "bg-white/5 border-border text-muted-foreground hover:text-white"
                }`}>
                {l}
              </button>
            ))}
          </div>

          {profits && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard label={`ربح الطلبات — ${period}`} value={fmtUsd(n(profits.profits?.orders?.USD))} color="#10b981" />
                <KpiCard label={`ربح الإيداعات (EGP) — ${period}`} value={fmt(n(profits.profits?.deposits?.EGP), "EGP")} color="#38bdf8" />
                <KpiCard label={`ربح الإيداعات (SAR) — ${period}`} value={fmt(n(profits.profits?.deposits?.SAR), "SAR")} color="#a78bfa" />
                <KpiCard label="المبيعات الإجمالية" value={fmtUsd(n(profits.sales?.USD))} color="#e2e8f0" />
                <KpiCard label="تكاليف الموردين" value={fmtUsd(n(profits.costs?.USD))} color="#ef4444" />
                <KpiCard label="عدد الطلبات / الإيداعات"
                  value={`${profits.counts?.orders || 0} / ${profits.counts?.deposits || 0}`}
                  color="#e2e8f0" />
              </div>

              {/* Most Profitable */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ["🏆 أكثر الخدمات ربحاً", profits.mostProfitable?.services, "profitUsd", "USD"],
                  ["👑 أكثر العملاء إنفاقاً", profits.mostProfitable?.customers, "profitUsd", "USD"],
                  ["💳 وسائل الدفع", profits.mostProfitable?.paymentMethods, "profit", null],
                ].map(([title, rows, key, fixedCur]: any) => (
                  <div key={title} className="rounded-xl border border-border/40 bg-[#0b1120] p-4">
                    <div className="font-bold text-sm mb-3">{title}</div>
                    {!rows || rows.length === 0 ? (
                      <p className="text-muted-foreground text-xs">تظهر بعد تسجيل حركات أو تشغيل الترحيل.</p>
                    ) : rows.map((row: any) => (
                      <div key={row.id} className="flex justify-between gap-2 py-2 border-b border-border/20 text-sm last:border-0">
                        <span className="text-muted-foreground text-xs truncate">{row.label || row.id}</span>
                        <strong className="text-emerald-400 font-mono text-xs whitespace-nowrap">
                          {n(row[key]).toFixed(2)} {fixedCur || row.currency || ""}
                        </strong>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TRANSACTIONS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "transactions" && (
        <DataTable
          cols={["النوع", "المستخدم", "المبلغ", "الرصيد قبل", "الرصيد بعد", "الوصف", "التاريخ"]}
          rows={transactions.map(t => [
            <span key="ty" className="font-mono text-xs text-primary">{t.type}</span>,
            <span key="u" className="text-xs text-muted-foreground">{t.userId?.slice(0, 10)}...</span>,
            <span key="am" className={`font-mono font-bold ${t.type === "deposit" || t.type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
              {t.type === "order_payment" ? "−" : "+"}{n(t.amount).toFixed(4)} {t.currency || "USD"}
            </span>,
            <span key="bb" className="font-mono text-xs">{n(t.balanceBefore).toFixed(4)}</span>,
            <span key="ba" className="font-mono text-xs">{n(t.balanceAfter).toFixed(4)}</span>,
            <span key="desc" className="text-xs text-muted-foreground">{t.description || "—"}</span>,
            <span key="d" className="text-xs text-muted-foreground whitespace-nowrap">
              {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US") : "—"}
            </span>,
          ])}
        />
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* ASSETS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "assets" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            {(["USD", "EGP", "SAR"] as Currency[]).map(cur => (
              <KpiCard key={cur} label={`إجمالي الأصول — ${cur}`} value={fmt(n(assetTotals[cur]), cur)} color="#10b981" />
            ))}
          </div>
          {/* Add asset form */}
          <div className="rounded-xl border border-border/40 bg-[#0b1120] p-4">
            <div className="text-sm font-bold mb-3">إضافة أصل جديد</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { ph: "اسم الأصل: Binance / بنك CIB...", key: "name" as const },
              ].map(({ ph, key }) => (
                <input key={key} placeholder={ph} value={assetForm[key]}
                  onChange={e => setAssetForm({ ...assetForm, [key]: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-black/30 border border-border text-sm text-foreground outline-none focus:border-primary/40" />
              ))}
              <GenericCustomSelect
                value={assetForm.type}
                title="نوع الأصل الحسابي"
                options={["Exchange", "Wallet", "Bank", "Cash", "Other"].map(t => ({ value: t, label: t }))}
                onChange={val => setAssetForm({ ...assetForm, type: val })}
              />
              <GenericCustomSelect
                value={assetForm.currency}
                title="عملة الحساب"
                options={["USD", "EGP", "SAR"].map(c => ({ value: c, label: c }))}
                onChange={val => setAssetForm({ ...assetForm, currency: val })}
              />
              <input type="number" min="0" step="0.01" placeholder="الرصيد" value={assetForm.balance}
                onChange={e => setAssetForm({ ...assetForm, balance: e.target.value })}
                className="px-3 py-2 rounded-lg bg-black/30 border border-border text-sm text-foreground outline-none" />
              <input placeholder="ملاحظات (اختياري)" value={assetForm.notes}
                onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })}
                className="px-3 py-2 rounded-lg bg-black/30 border border-border text-sm text-foreground outline-none" />
              <button onClick={saveAsset}
                className="inline-flex items-center justify-center gap-2 bg-primary text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-primary/90 transition-colors">
                <Plus size={15} /> إضافة
              </button>
            </div>
          </div>
          <DataTable
            cols={["الأصل", "النوع", "العملة", "الرصيد", "آخر تحديث", "إجراء"]}
            rows={assets.map(a => [
              <strong key="n">{a.name}</strong>,
              <span key="t" className="text-muted-foreground text-xs">{a.type}</span>,
              <span key="c" className="font-mono text-xs">{a.currency}</span>,
              <span key="b" className="font-mono font-bold text-emerald-400">{fmt(n(a.balance), a.currency as Currency)}</span>,
              <span key="u" className="text-xs text-muted-foreground">{a.lastUpdated ? new Date(a.lastUpdated).toLocaleDateString("en-US") : "—"}</span>,
              <button key="e" onClick={() => editAssetBalance(a)}
                className="bg-white/5 hover:bg-white/10 border border-border px-3 py-1 rounded-lg text-xs transition-all">
                تعديل
              </button>,
            ])}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* LEDGER */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "ledger" && (
        <div className="flex flex-col gap-4">
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2">
            📋 دفتر الأستاذ — سجلات مالية غير قابلة للتعديل
          </div>
          <DataTable
            cols={["التاريخ", "النوع", "الاتجاه", "العملة", "المبلغ", "الحساب", "المرجع", "الوصف"]}
            rows={ledger.map(e => [
              <span key="d" className="text-xs whitespace-nowrap">{e.createdAt ? new Date(e.createdAt).toLocaleString("en-US") : "—"}</span>,
              <span key="t" className="text-primary text-xs font-mono">{e.type}</span>,
              <span key="dir" className={`text-xs font-bold ${e.direction === "credit" ? "text-emerald-400" : "text-red-400"}`}>{e.direction}</span>,
              <span key="c">{e.currency}</span>,
              <span key="a" className="font-mono text-sm">{n(e.amount).toFixed(4)}</span>,
              <span key="acc" className="text-xs text-muted-foreground">{e.account}</span>,
              <span key="ref" className="font-mono text-[10px] text-muted-foreground">{e.referenceId?.slice(0, 10) || "—"}</span>,
              <span key="desc" className="text-xs">{e.description || "—"}</span>,
            ])}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* REPORTS */}
      {/* ══════════════════════════════════════════════════ */}
      {activeSection === "reports" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-border/40 bg-[#0b1120] p-5">
            <div className="font-bold text-sm mb-4">📅 تقرير بنطاق زمني مخصص</div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">من تاريخ</label>
                <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-black/30 border border-border text-sm text-foreground outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">إلى تاريخ</label>
                <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-black/30 border border-border text-sm text-foreground outline-none" />
              </div>
              <button onClick={loadCustomReport}
                className="bg-primary text-black font-bold px-4 py-2 rounded-lg text-sm">
                تطبيق
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-[#0b1120] p-5">
            <div className="font-bold text-sm mb-4">📊 ملخص مالي حالي</div>
            <DataTable
              cols={["العملة", "الأصول", "أرصدة العملاء", "أموال الشركة", "صافي الربح"]}
              rows={(["USD", "EGP", "SAR"] as Currency[]).map(cur => [
                <strong key="c">{cur}</strong>,
                <span key="a" className="font-mono">{fmt(n(overview?.totalAssets?.[cur]), cur)}</span>,
                <span key="cb" className="font-mono text-amber-400">{fmt(n(overview?.customerBalances?.[cur]), cur)}</span>,
                <span key="cf" className="font-mono font-bold text-emerald-400">{fmt(n(overview?.companyFunds?.[cur]), cur)}</span>,
                <span key="np" className="font-mono">{fmt(n(overview?.netProfit?.[cur]), cur)}</span>,
              ])}
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={() => exportLedger("csv")}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-sm font-bold transition-all">
              تصدير CSV
            </button>
            <button onClick={() => exportLedger("xls")}
              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-lg text-sm font-bold transition-all">
              تصدير Excel
            </button>
            <button onClick={() => window.print()}
              className="bg-white/5 hover:bg-white/10 text-foreground border border-border px-4 py-2 rounded-lg text-sm font-bold transition-all">
              طباعة / PDF
            </button>
            <button onClick={runMigration}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-4 py-2 rounded-lg text-sm font-bold transition-all mr-auto">
              ترحيل البيانات القديمة
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* CUSTOMER DETAIL MODAL */}
      {/* ══════════════════════════════════════════════════ */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedCustomer(null)}>
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/50 bg-[#0b1120] p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="font-black text-xl text-foreground">{selectedCustomer.customer?.name}</div>
                <div className="text-muted-foreground text-sm mt-0.5">{selectedCustomer.customer?.email}</div>
                <div className="text-xs text-muted-foreground/60 mt-1">
                  {selectedCustomer.customer?.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"}
                  {selectedCustomer.customer?.createdAt && (
                    <> · عضو منذ {new Date(selectedCustomer.customer.createdAt).toLocaleDateString("en-US")}</>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)}
                className="bg-white/5 hover:bg-white/10 border border-border p-2 rounded-xl transition-all">
                <X size={18} />
              </button>
            </div>

            {/* Balance cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {(["USD", "EGP", "SAR"] as Currency[]).map(cur => (
                <div key={cur} className="rounded-xl bg-black/30 border border-border/40 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{cur === "USD" ? "الرصيد الفعلي" : `المكافئ ${cur}`}</div>
                  <div className="font-mono font-black text-base text-foreground">
                    {fmt(n(selectedCustomer.customer?.balances?.[cur]?.total), cur)}
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            {selectedCustomer.customer?.stats && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">إجمالي الإيداعات</div>
                  <div className="font-mono font-bold text-emerald-400">{fmtUsd(n(selectedCustomer.customer.stats.totalDepositsUsd))}</div>
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">إجمالي المصروفات</div>
                  <div className="font-mono font-bold text-red-400">{fmtUsd(n(selectedCustomer.customer.stats.totalSpentUsd))}</div>
                </div>
                <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-3 text-center">
                  <div className="text-xs text-muted-foreground mb-1">إجمالي المسترد</div>
                  <div className="font-mono font-bold text-purple-400">{fmtUsd(n(selectedCustomer.customer.stats.totalRefundsUsd))}</div>
                </div>
              </div>
            )}

            {/* Transactions */}
            <div className="text-sm font-bold mb-3">كشف حركات المحفظة ({selectedCustomer.transactions?.length || 0})</div>
            <div className="overflow-x-auto rounded-xl border border-border/40 mb-4">
              <table className="w-full min-w-[500px] border-collapse text-sm text-right">
                <thead className="bg-black/20">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-3 py-2">التاريخ</th>
                    <th className="px-3 py-2">النوع</th>
                    <th className="px-3 py-2">المبلغ</th>
                    <th className="px-3 py-2">الرصيد بعد</th>
                    <th className="px-3 py-2">الوصف</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedCustomer.transactions || []).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-muted-foreground text-xs">لا توجد حركات</td></tr>
                  ) : (selectedCustomer.transactions || []).map((t: any, i: number) => (
                    <tr key={i} className="border-t border-border/30 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-US") : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs text-primary">{t.type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`font-mono font-bold text-sm ${t.type === "deposit" || t.type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                          {t.type === "order_payment" ? "−" : "+"}{n(t.amount).toFixed(4)} USD
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{n(t.balanceAfter).toFixed(4)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{t.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-400/80">
              ⚠️ محفظة الخدمات غير قابلة للسحب — الاستردادات تعود إلى رصيد الخدمات فقط.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
