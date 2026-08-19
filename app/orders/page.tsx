"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import {
  Package,
  QrCode,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Copy,
  Info,
  X,
  Eye,
  CreditCard,
  AlertTriangle,
  ChevronLeft,
  FileText,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { useCurrency } from "../lib/currency-context";
import AppShell from "../components/layout/AppShell";
import { toast } from "sonner";

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { convertPrice } = useCurrency();
  const [authChecking, setAuthChecking] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  useEffect(() => {
    document.title = "طلباتي | ZAITX MEDIA";
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else {
        setAuthChecking(false);
      }
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadOrders = async () => {
      const response = await fetch("/api/orders?limit=100", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to load orders");
      const result = await response.json();
      if (active) setOrders(result.orders || []);
    };
    void loadOrders().catch(console.error);
    const refreshTimer = window.setInterval(
      () => void loadOrders().catch(console.error),
      10000,
    );
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [user]);

  const handleDownloadPdfStatement = () => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filteredOrders = orders.filter((o) => {
      const time = new Date(o.createdAt || o.created_at || 0).getTime();
      return time >= thirtyDaysAgo;
    });

    if (filteredOrders.length === 0) {
      toast.error("لا توجد طلبات خلال الـ 30 يوماً الماضية لإنشاء التقرير 📜");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("يرجى السماح بالنوافذ المنبثقة لتحميل التقرير PDF");
      return;
    }

    const rowsHtml = filteredOrders.map((o, idx) => {
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString("ar-EG") : "-";
      const priceFormatted = convertPrice(o.totalPriceEgp || o.price_egp || 0).formatted;
      const statusLabel = o.status === "completed" ? "مكتمل ✅" : o.status === "canceled" || o.status === "rejected" ? "ملغي ❌" : "جاري التنفيذ ⏳";
      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 12px; text-align: center; font-weight: bold;">${idx + 1}</td>
          <td style="padding: 12px; font-family: monospace; font-weight: bold;">#${o.id?.slice(0, 10) || "-"}</td>
          <td style="padding: 12px; font-weight: bold;">${o.serviceName || o.service_name || o.name || "خدمة رقمية"}</td>
          <td style="padding: 12px; text-align: center; font-family: monospace;">${dateStr}</td>
          <td style="padding: 12px; text-align: center; font-weight: bold; color: #059669;">${priceFormatted}</td>
          <td style="padding: 12px; text-align: center; font-weight: bold;">${statusLabel}</td>
        </tr>
      `;
    }).join("");

    const totalSpentEgp = filteredOrders.reduce((sum, o) => sum + (Number(o.totalPriceEgp || o.price_egp) || 0), 0);
    const totalSpentFormatted = convertPrice(totalSpentEgp).formatted;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>التقرير المالي الكشف المالي (آخر 30 يوم) - ZAITX MEDIA</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0f172a; line-height: 1.6; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 900; color: #0284c7; margin: 0; }
            .subtitle { font-size: 13px; color: #64748b; margin-top: 4px; }
            .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px; }
            th { background: #f1f5f9; padding: 14px 12px; text-align: right; border-bottom: 2px solid #cbd5e1; font-weight: 800; }
            .summary { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: left; font-size: 16px; font-weight: bold; color: #047857; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">ZAITX MEDIA — التقرير المالي الموثق</h1>
              <div class="subtitle">كشف الطلبات والخدمات المكتملة خلال آخر 30 يوماً</div>
            </div>
            <div style="text-align: left;">
              <div style="font-weight: bold; font-size: 14px;">تاريخ الإصدار: ${new Date().toLocaleDateString("ar-EG")}</div>
              <div style="font-size: 12px; color: #64748b;">توقيت البيان: ${new Date().toLocaleTimeString("ar-EG")}</div>
            </div>
          </div>

          <div class="info-card">
            <div><strong>اسم الحساب:</strong> ${user?.displayName || user?.email || "عميل ZAITX"}</div>
            <div><strong>البريد الإلكتروني:</strong> ${user?.email || "-"}</div>
            <div><strong>فترة التقرير:</strong> آخر 30 يوماً</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center;">#</th>
                <th>رقم الطلب</th>
                <th>اسم الخدمة</th>
                <th style="text-align: center;">التاريخ والوقت</th>
                <th style="text-align: center;">المبلغ</th>
                <th style="text-align: center;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary">
            <span>إجمالي عدد الطلبات: <strong>${filteredOrders.length} طلبات</strong></span> | 
            <span>إجمالي المصروفات: <strong>${totalSpentFormatted}</strong></span>
          </div>

          <div style="margin-top: 40px; text-align: center;" class="no-print">
            <button onclick="window.print()" style="background: #0284c7; color: white; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 10px; cursor: pointer;">
              🖨️ طباعة أو حفظ التقرير كملف PDF
            </button>
          </div>

          <script>
            setTimeout(() => { window.print(); }, 500);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (authChecking) {
    return (
      <div className="premium-loader-container">
        <div className="premium-loader-wrapper">
          <div className="premium-loader"></div>
          <div className="premium-loader-inner"></div>
        </div>
        <span className="premium-loader-text">جاري التحميل...</span>
      </div>
    );
  }

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case "pending":
      case "pending_action":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm">
            <Clock size={13} /> قيد المراجعة والتنفيذ
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm">
            <CheckCircle size={13} /> مكتمل ✅
          </span>
        );
      case "rejected":
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-red-500/10 text-red-400 border border-red-500/30 shadow-sm">
            <XCircle size={13} /> مرفوض
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getPaymentStatusDisplay = (paymentStatus?: string) => {
    switch (paymentStatus) {
      case "paid":
        return <span className="text-emerald-400 font-bold">مدفوع</span>;
      case "verifying":
        return <span className="text-amber-400 font-bold">جاري التحقق التلقائي</span>;
      case "awaiting_payment":
        return <span className="text-cyan-400 font-bold">بانتظار التحويل</span>;
      default:
        return <span className="text-slate-300">مكتمل / محفظة</span>;
    }
  };

  return (
    <AppShell>
      <main dir="rtl" className="mx-auto mt-2 w-full max-w-5xl px-3 sm:px-4 pb-24">
        <div className="mb-7 text-center">
          <span className="mb-2 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-black text-cyan-300">
            مركز المتابعة والطلبات
          </span>
          <h1 className="text-2xl font-black text-white md:text-3xl">طلباتك في مكان واحد</h1>
          <p className="mt-2 text-sm text-slate-400">
            اضغط على أي طلب لمتابعة التفاصيل الكاملة وحالة التنفيذ لحظة بلحظة
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={handleDownloadPdfStatement}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-primary/20 to-emerald-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-black text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
            >
              <FileText size={16} className="text-cyan-400" />
              <span>📜 إصدار التقرير المالي PDF (آخر 30 يوم)</span>
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-6 py-16 text-center shadow-xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Package size={30} />
            </div>
            <p className="leading-8 text-slate-400 font-bold">ليس لديك أي طلبات حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2">
            {orders.map((o) => (
              <div
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="group cursor-pointer rounded-2xl p-5 bg-slate-950/90 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-300 shadow-xl relative overflow-hidden active:scale-[0.99]"
              >
                <div className="mb-4 flex items-start justify-between border-b border-slate-800/80 pb-4">
                  <div>
                    <h3 className="mb-1 text-base font-black text-white group-hover:text-cyan-400 transition-colors" dir="auto" style={{ unicodeBidi: "plaintext" }}>
                      <bdi>{o.service_name || o.serviceName}</bdi>
                    </h3>
                    <div className="font-mono text-xs text-slate-500 flex items-center gap-1.5 select-none pointer-events-none">
                      <span>#{o.id.substring(0, 12)}</span>
                    </div>
                  </div>
                  <div>{getStatusDisplay(o.status)}</div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/60">
                    <span className="mb-1 block text-[11px] text-slate-400 font-semibold">التكلفة</span>
                    <strong className="text-sm text-cyan-400 font-black">
                      {convertPrice(o.price || o.totalPriceEgp || o.price_egp || 0).formatted}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/60">
                    <span className="mb-1 block text-[11px] text-slate-400 font-semibold">الكمية</span>
                    <strong className="text-sm text-white font-black">{o.quantity}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/60">
                    <span className="mb-1 block text-[11px] text-slate-400 font-semibold">التاريخ</span>
                    <span className="text-xs text-slate-300 font-bold">
                      {new Date(o.created_at || o.createdAt || Date.now()).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                </div>

                {/* Privacy Badge for Completed Orders */}
                {o.status === "completed" && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs flex items-center justify-between">
                    <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                      <Lock size={14} /> تم إكتمال طلبك بنجاح وحذف البيانات الحساسة 🔒
                    </span>
                  </div>
                )}

                {/* Action Indicator Bar */}
                <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-slate-800/80">
                  <span className="text-slate-400 group-hover:text-white transition-colors flex items-center gap-1.5 font-bold">
                    <Eye size={14} className="text-cyan-400" /> اضغط لعرض التفاصيل الكاملة
                  </span>
                  <ChevronLeft size={16} className="text-slate-500 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Order Details Modal */}
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 sm:p-4 animate-fadeIn"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-3xl border border-cyan-500/40 bg-slate-950/98 p-6 sm:p-8 shadow-2xl text-right font-['Cairo']"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header with Close Icon ONLY */}
              <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-xs font-black text-cyan-300">
                      تفاصيل الطلب
                    </span>
                    {getStatusDisplay(selectedOrder.status)}
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedOrder.service_name || selectedOrder.serviceName}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-xl bg-slate-800 p-2.5 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-700/60 shrink-0"
                  aria-label="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Order ID Banner (Unselectable & Copy Disabled) */}
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900/80 p-4 border border-slate-800/80 select-none">
                <div>
                  <span className="text-xs text-slate-400 block mb-1 font-semibold">معرف الطلب الموثق:</span>
                  <span className="font-mono text-sm text-cyan-400 font-black select-none pointer-events-none">#{selectedOrder.id}</span>
                </div>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-3 py-1.5 rounded-xl font-bold border border-slate-700">
                  غير قابل للنسخ 🔒
                </span>
              </div>

              {/* Status Stepper */}
              <div className="mt-5 rounded-2xl bg-slate-900/60 p-4 border border-slate-800/80">
                <h4 className="text-xs font-bold text-slate-400 mb-3">مراحل التنفيذ:</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/40">
                      ✓
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border ${
                        selectedOrder.paymentStatus === "paid"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : selectedOrder.paymentStatus === "verifying" || selectedOrder.paymentStatus === "awaiting_payment"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                      }`}
                    >
                      {selectedOrder.paymentStatus === "paid" ? "✓" : "2"}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        selectedOrder.paymentStatus === "paid"
                          ? "text-emerald-400"
                          : "text-amber-400"
                      }`}
                    >
                      {selectedOrder.paymentStatus === "paid" ? "تم الدفع" : "تأكيد الدفع"}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border ${
                        selectedOrder.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : selectedOrder.status === "rejected" || selectedOrder.status === "canceled"
                          ? "bg-red-500/20 text-red-400 border-red-500/40"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                      }`}
                    >
                      {selectedOrder.status === "completed" ? "✓" : "3"}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        selectedOrder.status === "completed"
                          ? "text-emerald-400"
                          : selectedOrder.status === "rejected" || selectedOrder.status === "canceled"
                          ? "text-red-400"
                          : "text-amber-400"
                      }`}
                    >
                      {selectedOrder.status === "completed"
                        ? "تم التنفيذ"
                        : selectedOrder.status === "rejected" || selectedOrder.status === "canceled"
                        ? "ملغي"
                        : "جاري المعالجة"}
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold border ${
                        selectedOrder.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-slate-800 text-slate-500 border-slate-700"
                      }`}
                    >
                      {selectedOrder.status === "completed" ? "✓" : "4"}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        selectedOrder.status === "completed"
                          ? "text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      تسليم الخدمة
                    </span>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">الخدمة:</span>
                  <strong className="text-white font-bold">{selectedOrder.service_name || selectedOrder.serviceName}</strong>
                </div>

                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">المبلغ المدفوع:</span>
                  <strong className="text-cyan-400 font-bold">
                    {convertPrice(selectedOrder.price || selectedOrder.totalPriceEgp || selectedOrder.price_egp || 0).formatted}
                  </strong>
                </div>

                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">الكمية المطلوبة:</span>
                  <strong className="text-white font-bold">{selectedOrder.quantity}</strong>
                </div>

                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">حالة الدفع:</span>
                  {getPaymentStatusDisplay(selectedOrder.paymentStatus)}
                </div>

                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">تاريخ الطلب:</span>
                  <span className="text-slate-200">
                    {new Date(selectedOrder.created_at || selectedOrder.createdAt || Date.now()).toLocaleString("ar-EG")}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-900/80 p-3.5 border border-slate-800/80">
                  <span className="text-slate-400 text-[11px] block mb-1">طريقة الدفع:</span>
                  <span className="text-slate-200 font-bold">
                    {selectedOrder.paymentMethodKey === "vodafone"
                      ? "فودافون كاش"
                      : selectedOrder.paymentMethodKey === "instapay"
                      ? "انستاباي"
                      : selectedOrder.paymentMethodKey === "barq"
                      ? "برق"
                      : "رصيد المحفظة"}
                  </span>
                </div>
              </div>

              {/* SENSITIVE DATA PRIVACY PROTECTION AFTER COMPLETION */}
              {selectedOrder.status === "completed" ? (
                <div className="mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                  <span className="text-emerald-400 font-bold block text-xs sm:text-sm flex items-center justify-center gap-2">
                    <ShieldAlert size={18} /> 🔒 تم مسح وحذف البيانات الحساسة (الروابط ورموز الدخول) لحماية حسابك فور اكتمال الطلب.
                  </span>
                </div>
              ) : (
                <>
                  {/* Target Input & Link Details for Pending Orders */}
                  <div className="mt-4 space-y-2">
                    {selectedOrder.link && (
                      <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/80">
                        <span className="text-slate-400 text-[11px] block mb-1">
                          الرابط / الآيدي المستهدف:
                        </span>
                        <span className="font-mono text-xs text-cyan-400 break-all dir-ltr text-right block">
                          {selectedOrder.link}
                        </span>
                      </div>
                    )}

                    {selectedOrder.whatsapp && (
                      <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/80">
                        <span className="text-slate-400 text-[11px] block mb-1">رقم الواتساب:</span>
                        <span className="font-mono text-xs text-slate-200 dir-ltr text-right block">
                          {selectedOrder.whatsapp}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Delivered Link Result */}
                  {(selectedOrder.delivered_link || selectedOrder.authLink) && (
                    <div className="mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-center">
                      <span className="text-emerald-400 font-bold block mb-2 text-sm flex items-center justify-center gap-1.5">
                        <CheckCircle size={16} /> تم تجهيز رابط التسجيل بنجاح!
                      </span>
                      <a
                        href={selectedOrder.delivered_link || selectedOrder.authLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-bold text-black hover:bg-cyan-300 transition-all shadow-lg shadow-cyan-500/20 w-full sm:w-auto no-underline"
                      >
                        <ExternalLink size={18} /> فتح رابط التسجيل
                      </a>
                    </div>
                  )}

                  {/* Delivered QR Result */}
                  {selectedOrder.qr_image && (
                    <div className="mt-5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 p-4 text-center">
                      <div className="text-white font-bold mb-3 flex items-center justify-center gap-2">
                        <QrCode size={18} className="text-cyan-400" /> رمز QR الخاص بتسجيل الدخول
                      </div>
                      <img
                        src={selectedOrder.qr_image}
                        alt="QR Code"
                        className="mx-auto max-w-[200px] rounded-xl border-2 border-white bg-white p-2 shadow-lg"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Reject Reason Result */}
              {selectedOrder.reject_reason && (
                <div className="mt-5 rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-red-400 text-xs sm:text-sm">
                  <strong className="block mb-1 text-red-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} /> سبب عدم التنفيذ / الرفض:
                  </strong>
                  <p className="leading-6">{selectedOrder.reject_reason}</p>
                </div>
              )}

              {/* Action Button for Pending Payment */}
              {(selectedOrder.paymentStatus === "awaiting_payment" ||
                selectedOrder.paymentStatus === "verifying") && (
                <div className="mt-6 flex justify-end pt-4 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      router.push(`/orders/${selectedOrder.id}/pay`);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 font-black text-black hover:bg-cyan-300 transition-all shadow-lg cursor-pointer"
                  >
                    <CreditCard size={18} /> متابعة / إتمام الدفع
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
