import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  try {
    await requireAdmin();
    const [users, orders, pending, admins] = await Promise.all([
      adminDb.collection("profiles").count().get(),
      adminDb.collection("orders").count().get(),
      adminDb.collection("orders").where("status", "==", "pending").count().get(),
      adminDb.collection("profiles").where("role", "==", "admin").count().get(),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        users: users.data().count,
        orders: orders.data().count,
        pending: pending.data().count,
        admins: admins.data().count,
      },
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load admin dashboard", error);
    return NextResponse.json(
      { success: false, error: "Unable to load dashboard" },
      { status: 500 },
    );
  }
}
