import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

function timestampValue(value: unknown): number {
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (
    typeof value === "object"
    && value !== null
    && "toDate" in value
    && typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await adminDb.collection("orders").get();
    const orders: Array<Record<string, unknown> & { id: string }> = snapshot.docs
      .map((document): Record<string, unknown> & { id: string } => ({
        id: document.id,
        ...document.data(),
      }))
      .sort((left, right) => (
        timestampValue(right.created_at ?? right.createdAt)
        - timestampValue(left.created_at ?? left.createdAt)
      ))
      .slice(0, 200);

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load admin orders", error);
    return NextResponse.json(
      { success: false, error: "Unable to load orders" },
      { status: 500 },
    );
  }
}
