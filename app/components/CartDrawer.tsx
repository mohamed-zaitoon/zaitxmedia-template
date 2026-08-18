"use client";

import React, { useState } from "react";
import { useCart } from "../lib/cart-context";
import { useCurrency } from "../lib/currency-context";
import { useAuth } from "../lib/auth-context";
import { ShoppingBag, X, Trash2, ArrowLeft, CheckCircle2, ShoppingCart, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function CartDrawer() {
  const { cart, removeFromCart, clearCart, isCartOpen, setIsCartOpen, totalAmountEgp, cartCount } = useCart();
  const { convertPrice, rates } = useCurrency();
  const { user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  if (!isCartOpen) return null;

  const handleCheckoutCart = async () => {
    if (!user) {
      toast.error("الرجاء تسجيل الدخول أولاً لإتمام طلبات السلة");
      router.push("/login");
      setIsCartOpen(false);
      return;
    }

    if (cart.length === 0) return;

    const currentBalanceUsd = Number(user?.balance) || 0;
    const currentBalanceEgp = currentBalanceUsd * rates.usd;
    const hasEnoughBalance = Math.round(currentBalanceEgp * 100) >= Math.round(totalAmountEgp * 100);

    if (!hasEnoughBalance) {
      toast.error(`رصيدك الحالي (${convertPrice(currentBalanceEgp).formatted}) غير كافٍ لإتمام طلبات السلة (${convertPrice(totalAmountEgp).formatted}). يرجى شحن الرصيد أولاً.`);
      router.push("/recharge");
      setIsCartOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const createdOrders = [];
      for (const item of cart) {
        const res = await fetch("/api/orders/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            serviceId: item.serviceId,
            serviceName: item.serviceName,
            quantity: item.quantity,
            priceEGP: item.totalPriceEgp,
            link: item.link,
            options: item.options || {},
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.orderId) {
          createdOrders.push(data.orderId);
          // Send instant notification to admin
          fetch("/api/admin/notify-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: data.orderId }),
          }).catch(console.error);
        }
      }

      if (createdOrders.length > 0) {
        toast.success(`تم إنشاء ${createdOrders.length} طلب بنجاح! 🎉`, { duration: 5000 });
        clearCart();
        setIsCartOpen(false);
        if (createdOrders.length === 1) {
          router.push(`/orders/${createdOrders[0]}/pay`);
        } else {
          router.push("/orders");
        }
      } else {
        toast.error("تعذر إتمام طلبات السلة، حاول مرة أخرى.");
      }
    } catch (err) {
      console.error("Cart checkout error:", err);
      toast.error("حدث خطأ غير متوقع أثناء الشراء المجمع");
    } finally {
      setSubmitting(false);
    }
  };

  const formattedTotal = convertPrice(totalAmountEgp).formatted;
  const currentBalanceUsd = Number(user?.balance) || 0;
  const currentBalanceEgp = currentBalanceUsd * rates.usd;
  const hasEnoughBalance = Math.round(currentBalanceEgp * 100) >= Math.round(totalAmountEgp * 100);

  return (
    <div
      className="fixed inset-0 z-[9999] flex justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsCartOpen(false);
      }}
    >
      <div className="relative w-full max-w-md bg-[#091321] border-l border-[#1e3050] h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-5 border-b border-[#1e3050] flex items-center justify-between bg-[#0d1b2e]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
              <ShoppingCart size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-white truncate">سلة الطلبات</h2>
              <p className="text-xs text-muted-foreground truncate">{cartCount} طلبات مجمعة في السلة</p>
            </div>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground gap-3">
              <ShoppingBag size={48} className="text-slate-600 stroke-[1.5]" />
              <p className="font-semibold text-sm">سلة الطلبات فارغة حالياً</p>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                يمكنك إضافة عدة طلبات وألعاب من الموقع وسوف تظهر جميعها هنا للشراء المجمع بنقرة واحدة.
              </p>
            </div>
          ) : (
            cart.map((item) => {
              const itemFormattedPrice = convertPrice(item.totalPriceEgp).formatted;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-[#111b2e] border border-[#233857] flex flex-col gap-2.5 shadow-md relative group hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-primary/10 text-primary border border-primary/20 mb-1">
                        <bdi dir="auto">{item.categoryName || "خدمة"}</bdi>
                      </span>
                      <h4 className="text-xs font-bold text-white break-words leading-snug" dir="auto" style={{ unicodeBidi: "plaintext" }}>
                        <bdi>{item.serviceName}</bdi>
                      </h4>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0"
                      title="حذف هذا الطلب"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-300 pt-2 border-t border-[#1b2b44]/80 flex-wrap gap-2">
                    <div className="break-all font-mono text-[11px] text-slate-400 max-w-[200px]" dir="ltr">
                      {item.link || "بدون رابط"}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-slate-400">الكمية: {item.quantity}</span>
                      <span className="font-bold text-primary font-mono text-sm" dir="ltr" style={{ unicodeBidi: "isolate" }}>
                        <bdi>{itemFormattedPrice}</bdi>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer / Summary */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-[#1e3050] bg-[#0c182b] flex flex-col gap-3.5 shadow-2xl">
            {user && !hasEnoughBalance && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertCircle size={16} className="shrink-0 text-amber-400" />
                  <span className="truncate">رصيدك ({convertPrice(currentBalanceEgp).formatted}) غير كافٍ</span>
                </div>
                <button
                  onClick={() => { setIsCartOpen(false); router.push("/recharge"); }}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs shrink-0 transition-all shadow-md active:scale-95"
                >
                  شحن الرصيد ⚡
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-sm pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-semibold">الإجمالي المستحق:</span>
                <button
                  onClick={clearCart}
                  disabled={submitting}
                  className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1 font-semibold transition-colors cursor-pointer mr-2"
                  title="تفريغ السلة بالكامل"
                >
                  <Trash2 size={13} /> تفريغ
                </button>
              </div>
              <span className="text-xl font-black text-primary font-mono">{formattedTotal}</span>
            </div>

            <button
              onClick={handleCheckoutCart}
              disabled={submitting}
              className="w-full min-h-[52px] rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                "جاري إرسال الطلبات..."
              ) : (
                <>
                  <ShoppingCart size={20} className="shrink-0" />
                  إتمام الطلبات ⚡
                </>
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
