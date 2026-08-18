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
  const [copiedId, setCopiedId] = useState(false);

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
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={13} /> قيد المراجعة والتنفيذ
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={13} /> مكتمل
          </span>
        );
      case "rejected":
      case "canceled":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
            <XCircle size={13} /> مرفوض
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-muted/20 text-muted-foreground border border-border">
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
        return <span className="text-primary font-bold">بانتظار التحويل</span>;
      default:
        return <span className="text-slate-300">مكتمل / محفظة</span>;
    }
  };

  const copyOrderId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(true);
      toast.success("تم نسخ معرف الطلب بنجاح");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  return (
    <AppShell>
      <main dir="rtl" className="mx-auto mt-2 w-full max-w-5xl px-2">
        <div className="mb-7 text-center">
          <span className="mb-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            مركز المتابعة
          </span>
          <h1 className="text-2xl font-black text-white md:text-3xl">طلباتك في مكان واحد</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            اضغط على أي طلب لمتابعة التفاصيل الكاملة وحالة التنفيذ لحظة بلحظة
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="premium-surface mt-10 rounded-3xl px-6 py-16 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Package size={30} />
            </div>
            <p className="leading-8 text-muted-foreground">ليس لديك أي طلبات حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orders.map((o) => (
              <div
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="premium-surface group cursor-pointer rounded-2xl p-5 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 relative overflow-hidden"
              >
                <div className="mb-4 flex items-start justify-between border-b border-white/[0.06] pb-4">
                  <div>
                    <h3 className="mb-1 text-base font-black text-white group-hover:text-primary transition-colors" dir="auto" style={{ unicodeBidi: "plaintext" }}>
                      <bdi>{o.service_name}</bdi>
                    </h3>
                    <div className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                      <span>#{o.id.substring(0, 12)}</span>
                    </div>
                  </div>
                  <div>{getStatusDisplay(o.status)}</div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <span className="mb-1 block text-[11px] text-muted-foreground">التكلفة</span>
                    <strong className="text-sm text-primary">
                      {convertPrice(o.price).formatted}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <span className="mb-1 block text-[11px] text-muted-foreground">الكمية</span>
                    <strong className="text-sm text-white">{o.quantity}</strong>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <span className="mb-1 block text-[11px] text-muted-foreground">التاريخ</span>
                    <span className="text-xs text-slate-300">
                      {new Date(o.created_at).toLocaleDateString("en-US")}
                    </span>
                  </div>
                </div>

                {/* Delivered Link Quick View */}
                {o.delivered_link && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs flex items-center justify-between">
                    <span className="font-bold text-emerald-400">جاهز للتسجيل:</span>
                    <span className="bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-lg hover:bg-primary/20 transition-all flex items-center gap-1 font-bold no-underline">
                      فتح الرابط <ExternalLink size={12} />
                    </span>
                  </div>
                )}

                {/* Delivered QR Quick View */}
                {o.qr_image && o.qr_expires_at && o.qr_expires_at > Date.now() && (
                  <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs flex items-center justify-between">
                    <span className="font-bold text-primary flex items-center gap-1">
                      <QrCode size={14} /> رمز QR جاهز
                    </span>
                    <span className="text-amber-400 font-bold">عرض الرمز</span>
                  </div>
                )}

                {/* Action Indicator Bar */}
                <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-white/[0.04]">
                  <span className="text-muted-foreground group-hover:text-white transition-colors flex items-center gap-1 font-medium">
                    <Eye size={13} className="text-primary" /> اضغط لعرض التفاصيل الكامله
                  </span>
                  <ChevronLeft size={14} className="text-muted-foreground group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Full Order Details Modal */}
        {selectedOrder && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-lg animate-fadeIn"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-3xl border border-primary/30 bg-[#121216] p-5 sm:p-7 pb-28 sm:pb-7 shadow-2xl text-right font-['Cairo']"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border/50 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      تفاصيل الطلب
                    </span>
                    {getStatusDisplay(selectedOrder.status)}
                  </div>
                  <h2 className="text-xl font-black text-white">{selectedOrder.service_name}</h2>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-full bg-white/10 p-2 text-muted-foreground hover:bg-white/20 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Order ID Banner */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-white/[0.04] p-3 border border-white/[0.06]">
                <div>
                  <span className="text-xs text-muted-foreground block mb-0.5">معرف الطلب:</span>
                  <span className="font-mono text-sm text-primary font-bold">#{selectedOrder.id}</span>
                </div>
                <button
                  onClick={() => copyOrderId(selectedOrder.id)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 border border-primary/20 transition-all"
                >
                  <Copy size={13} /> {copiedId ? "تم النسخ" : "نسخ المعرف"}
                </button>
              </div>

              {/* Status Stepper */}
              <div className="mt-6 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.05]">
                <h4 className="text-xs font-bold text-muted-foreground mb-3">مراحل التنفيذ:</h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/40">
                      ✓
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400">إنشاء الطلب</span>
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
                          ? "bg-destructive/20 text-destructive border-destructive/40"
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
                          ? "text-destructive"
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
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}
                    >
                      {selectedOrder.status === "completed" ? "✓" : "4"}
                    </div>
                    <span
                      className={`text-[11px] font-bold ${
                        selectedOrder.status === "completed"
                          ? "text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      تسليم الخدمة
                    </span>
                  </div>
                </div>
              </div>

              {/* Information Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">الخدمة:</span>
                  <strong className="text-white font-bold">{selectedOrder.service_name}</strong>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">المبلغ المدفوع:</span>
                  <strong className="text-primary font-bold">
                    {convertPrice(selectedOrder.price).formatted}
                  </strong>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">الكمية المطلوبة:</span>
                  <strong className="text-white font-bold">{selectedOrder.quantity}</strong>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">حالة الدفع:</span>
                  {getPaymentStatusDisplay(selectedOrder.paymentStatus)}
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">تاريخ الطلب:</span>
                  <span className="text-slate-200">
                    {new Date(selectedOrder.created_at).toLocaleString("en-US")}
                  </span>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                  <span className="text-muted-foreground text-[11px] block mb-1">طريقة الدفع:</span>
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

              {/* Target Input & Link Details */}
              <div className="mt-4 space-y-2">
                {selectedOrder.link && (
                  <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                    <span className="text-muted-foreground text-[11px] block mb-1">
                      الرابط / الآيدي المستهدف:
                    </span>
                    <span className="font-mono text-xs text-primary break-all dir-ltr text-right block">
                      {selectedOrder.link}
                    </span>
                  </div>
                )}

                {selectedOrder.whatsapp && (
                  <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                    <span className="text-muted-foreground text-[11px] block mb-1">رقم الواتساب:</span>
                    <span className="font-mono text-xs text-slate-200 dir-ltr text-right block">
                      {selectedOrder.whatsapp}
                    </span>
                  </div>
                )}

                {selectedOrder.options?.username && (
                  <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.05]">
                    <span className="text-muted-foreground text-[11px] block mb-1">
                      اسم المستخدم (اليوزر):
                    </span>
                    <span className="font-mono text-xs text-white font-bold">
                      {selectedOrder.options.username}
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
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 w-full sm:w-auto no-underline"
                  >
                    <ExternalLink size={18} /> فتح رابط تسجيل الدخول إلى تيك توك
                  </a>
                </div>
              )}

              {/* Delivered QR Result */}
              {selectedOrder.qr_image && (
                <div className="mt-5 rounded-2xl bg-primary/10 border border-primary/30 p-4 text-center">
                  <div className="text-white font-bold mb-3 flex items-center justify-center gap-2">
                    <QrCode size={18} className="text-primary" /> رمز QR الخاص بتسجيل الدخول
                  </div>
                  <img
                    src={selectedOrder.qr_image}
                    alt="QR Code"
                    className="mx-auto max-w-[200px] rounded-xl border-2 border-white bg-white p-2 shadow-lg"
                  />
                  {selectedOrder.qr_expires_at && selectedOrder.qr_expires_at > Date.now() ? (
                    <div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-amber-400 text-xs font-bold w-full">
                      <Clock size={14} className="shrink-0" />
                      <span>الرمز صالح واستخدمه الآن قبل الانتهاء.</span>
                    </div>
                  ) : (
                    <div className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500/20 border border-red-500/40 px-3 py-2.5 text-red-400 text-xs font-bold w-full shadow-inner">
                      <AlertTriangle size={15} className="shrink-0 text-red-400" />
                      <span>انتهت صلاحية رمز QR. يمكنك التواصل مع الدعم الفني لمساعدتك.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Reject Reason Result */}
              {selectedOrder.reject_reason && (
                <div className="mt-5 rounded-2xl bg-destructive/10 border border-destructive/30 p-4 text-destructive text-xs sm:text-sm">
                  <strong className="block mb-1 text-destructive font-bold flex items-center gap-1.5">
                    <AlertTriangle size={16} /> سبب عدم التنفيذ / الرفض:
                  </strong>
                  <p className="leading-6">{selectedOrder.reject_reason}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-border/50">
                {(selectedOrder.paymentStatus === "awaiting_payment" ||
                  selectedOrder.paymentStatus === "verifying") && (
                  <button
                    onClick={() => {
                      setSelectedOrder(null);
                      router.push(`/orders/${selectedOrder.id}/pay`);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-bold text-black hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                  >
                    <CreditCard size={18} /> متابعة / إتمام الدفع
                  </button>
                )}

                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-full sm:w-auto rounded-xl bg-white/10 px-6 py-3 text-sm font-bold text-white hover:bg-white/20 transition-all"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
