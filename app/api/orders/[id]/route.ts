import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "الرجاء تسجيل الدخول أولاً" }, { status: 401 });
    }

    const resolvedParams = await params;
    const orderId = resolvedParams.id;
    if (!orderId) {
      return NextResponse.json({ error: "معرف الطلب غير صحيح" }, { status: 400 });
    }

    const docSnap = await adminDb.collection("orders").doc(orderId).get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "الطلب غير موجود أو تم حذفه." }, { status: 404 });
    }

    const orderData = docSnap.data() || {};
    const isOwner = orderData.user_id === userId || orderData.userId === userId;
    if (!isOwner) {
      return NextResponse.json({ error: "لا يمكنك عرض هذا الطلب من الحساب الحالي." }, { status: 403 });
    }

    const safeOptions =
      orderData.options && typeof orderData.options === "object"
        ? { ...orderData.options, password: undefined }
        : orderData.options;

    const createdAt =
      typeof orderData.created_at === "string"
        ? orderData.created_at
        : orderData.createdAt?.toDate?.()?.toISOString?.()
          ?? orderData.created_at?.toDate?.()?.toISOString?.()
          ?? null;

    return NextResponse.json({
      success: true,
      order: {
        ...orderData,
        id: docSnap.id,
        options: safeOptions,
        created_at: createdAt,
      },
    });
  } catch (err: any) {
    console.error("Error in GET /api/orders/[id]:", err);
    return NextResponse.json({ error: "تعذر تحميل الطلب من السيرفر" }, { status: 500 });
  }
}
