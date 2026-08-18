import { NextResponse } from "next/server";
import { sendEmail } from "../../../lib/mailer";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { email, orderId, status, serviceName } = await request.json();

    if (!email) {
      return NextResponse.json({ success: true });
    }

    let subject = "";
    let html = "";

    if (status === "completed") {
      subject = "تم تنفيذ طلبك - ZAITX MEDIA";
      html = `<div dir="rtl">مرحباً،<br><br>تم تنفيذ طلبك بنجاح للخدمة: <strong>${serviceName}</strong> (طلب رقم #${orderId}).<br>شكراً لتعاملك معنا.</div>`;
    } else if (status === "rejected") {
      subject = "تم رفض طلبك - ZAITX MEDIA";
      html = `<div dir="rtl">مرحباً،<br><br>نعتذر، لقد تم رفض طلبك للخدمة: <strong>${serviceName}</strong> (طلب رقم #${orderId}).<br>تم استرداد الرصيد إلى محفظتك.<br>للتفاصيل، يمكنك مراجعة لوحة التحكم أو التواصل مع الدعم.</div>`;
    } else if (status === "provide_link") {
       subject = "تحديث بخصوص طلبك - ZAITX MEDIA";
       html = `<div dir="rtl">مرحباً،<br><br>تم تحديث طلبك للخدمة: <strong>${serviceName}</strong> (طلب رقم #${orderId}).<br>يرجى مراجعة صفحة "طلباتي" في المتجر لرؤية الرابط الجديد أو مسح رمز QR.<br>شكراً لك.</div>`;
    } else if (status === "cancelled") {
      subject = "تم إلغاء طلبك - ZAITX MEDIA";
      html = `<div dir="rtl">تم إلغاء طلبك للخدمة: <strong>${serviceName}</strong> (طلب رقم #${orderId}).</div>`;
    }

    if (subject && html) {
      await sendEmail({ to: email, subject, html });
    }

    try {
      const { adminDb } = await import("@/app/lib/firebase-admin");
      const orderSnap = await adminDb.collection("orders").doc(orderId).get();
      if (orderSnap.exists) {
        const orderData = orderSnap.data();
        if (orderData?.user_id) {
          const { sendOneSignalPush } = await import("@/app/utils/onesignal");
          
          let pushTitle = "";
          let pushBody = "";
          if (status === "completed") {
            pushTitle = "تم تنفيذ طلبك! ✅";
            pushBody = `تم تنفيذ طلبك بنجاح للخدمة: ${serviceName}`;
          } else if (status === "rejected") {
            pushTitle = "تم رفض طلبك ❌";
            pushBody = `نعتذر، تم رفض طلبك لخدمة ${serviceName} واسترداد الرصيد.`;
          } else if (status === "provide_link") {
            pushTitle = "تحديث بخصوص طلبك ℹ️";
            pushBody = `تم تحديث طلبك لخدمة ${serviceName}، يرجى مراجعة طلباتي.`;
          } else if (status === "cancelled") {
            pushTitle = "تم إلغاء طلبك";
            pushBody = `تم إلغاء طلبك لخدمة ${serviceName}.`;
          }

          if (pushTitle) {
            await sendOneSignalPush(
              orderData.user_id,
              pushTitle,
              pushBody,
              {
                url: `https://zaitxmedia.com/orders`,
                data: { type: "order_update", orderId, status },
              },
            );
          }
        }
      }
    } catch (pushErr) {
      console.error("Failed to send user push notification:", pushErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err);
    if (authResponse) return authResponse;
    console.error("Notify Order Error:", err);
    return NextResponse.json({ error: "Failed to notify" }, { status: 500 });
  }
}
