"use client";

import { motion } from "framer-motion";
import { FileText } from "lucide-react";

export default function TermsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "var(--bg-card)",
        padding: 32,
        borderRadius: 16,
        border: "1px solid var(--border-primary)",
        color: "#fff",
        lineHeight: 1.8,
        maxWidth: 800,
        margin: "0 auto",
      }}
      dir="rtl"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          paddingBottom: 16,
        }}
      >
        <FileText size={32} color="#38bdf8" />
        <h1 style={{ color: "#38bdf8", margin: 0, fontSize: 28 }}>
          شروط الخدمة
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            1. الموافقة على الشروط
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            باستخدامك لموقع "ZAITX MEDIA"، فإنك توافق بالكامل على هذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يحق لك استخدام خدماتنا.
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            2. الخدمات المقدمة
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            يقدم الموقع خدمات شحن الألعاب وخدمات الدعم لمنصات التواصل الاجتماعي. لا نتحمل المسؤولية عن أي تغييرات تطرأ على سياسات التطبيقات والمنصات التابعة لجهات خارجية (مثل تيك توك، ببجي، وغيرها) والتي قد تؤثر على الخدمات المباعة.
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            3. سياسة الدفع وعدم الاسترداد
          </h2>
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: 14, borderRadius: 12, marginBottom: 12 }}>
            <p style={{ color: "#f87171", fontSize: 15, fontWeight: "bold", margin: 0, lineHeight: 1.6 }}>
              ⚠️ بند هام جداً: جميع المبالغ المشحونة والمدفوعة في الموقع غير قابلة للاسترداد النقدي أو التحويل بأي شكل من الأشكال، نظراً لأن الأموال تذهب مباشرة لشبكة عملات رقمية (Cryptocurrency Network) وتأكيد معاملاتها غير قابل للإلغاء أو التراجع.
            </p>
          </div>
          <p style={{ color: "#aaa", fontSize: 15, lineHeight: 1.8 }}>
            • كافة عمليات الشحن والمبيعات تعتبر نهائية وغير قابلة للاسترداد بأي شكل من الأشكال.<br />
            • المبالغ المودعة تُستخدم حصرياً لشراء وطلب الخدمات الرقمية داخل المنصة.<br />
            • في حال تعذّر تنفيذ الطلب أو إلغائه من قبل النظام، يتم إعادة الرصيد إلى محفظة حسابك في الموقع لاستخدامه في خدمات أخرى.<br />
            • لا يتم استرداد أي أموال إذا قدم العميل بيانات خاطئة (مثل آيدي الحساب أو اسم المستخدم).
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            4. حساب المستخدم
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            أنت مسؤول عن الحفاظ على سرية معلومات حسابك وكلمة المرور الخاصة بك. أي نشاط يحدث تحت حسابك هو مسؤوليتك الكاملة. نحتفظ بالحق في تعليق أو إلغاء الحسابات التي تنتهك هذه الشروط.
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            5. إخلاء المسؤولية
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            نحن نسعى جاهدين لضمان عمل الموقع وتقديم الخدمات بأفضل شكل، لكننا لا نضمن عدم حدوث انقطاعات تقنية مؤقتة بسبب الصيانة أو ظروف خارجة عن إرادتنا.
          </p>
        </section>
      </div>
    </motion.div>
  );
}
