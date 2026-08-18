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
            3. سياسة الدفع والاسترداد
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            - كافة المبيعات نهائية بمجرد بدء تنفيذ الطلب.<br />
            - في حال حدوث خطأ من جانبنا أو فشل النظام في توفير الخدمة المطلوبة، سيتم تعويض العميل بالرصيد أو استرداد المبلغ.<br />
            - لا يوجد استرداد للأموال إذا قام العميل بتقديم بيانات خاطئة (مثل الـ ID أو اسم المستخدم).
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
