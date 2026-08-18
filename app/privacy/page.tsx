"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
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
        <ShieldCheck size={32} color="#38bdf8" />
        <h1 style={{ color: "#38bdf8", margin: 0, fontSize: 28 }}>
          سياسة الخصوصية
        </h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            1. جمع المعلومات
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            نقوم بجمع المعلومات التي تقدمها لنا مباشرة عند إنشاء حساب، أو
            تحديث ملفك الشخصي، أو التواصل معنا. قد تشمل هذه المعلومات اسمك، عنوان بريدك الإلكتروني، ورقم هاتفك (الواتساب).
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            2. استخدام المعلومات
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            نستخدم المعلومات التي نجمعها لتقديم خدماتنا، وتحسين تجربة المستخدم، وإرسال التحديثات الهامة حول حسابك أو طلباتك. نحن لا نبيع أو نشارك معلوماتك الشخصية مع أطراف ثالثة لأغراض تسويقية.
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            3. حماية البيانات
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            نحن نتخذ إجراءات أمنية صارمة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح أو الإتلاف. كافة الاتصالات بين متصفحك وخوادمنا مشفرة (SSL).
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            4. ملفات تعريف الارتباط (Cookies)
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            يستخدم الموقع ملفات تعريف الارتباط لتحسين تجربة تصفحك وتذكر تفضيلاتك. يمكنك إعداد متصفحك لرفض كل ملفات تعريف الارتباط، ولكن هذا قد يؤثر على عمل بعض أجزاء الموقع.
          </p>
        </section>

        <section>
          <h2 style={{ color: "#fff", fontSize: 20, marginBottom: 8 }}>
            5. التغييرات في سياسة الخصوصية
          </h2>
          <p style={{ color: "#aaa", fontSize: 15 }}>
            نحتفظ بالحق في تعديل سياسة الخصوصية هذه في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة، واستمرارك في استخدام الموقع يعني موافقتك على التغييرات الجديدة.
          </p>
        </section>
      </div>
    </motion.div>
  );
}
