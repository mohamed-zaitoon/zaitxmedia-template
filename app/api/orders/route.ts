import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

function serializeOrder(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const safeOptions =
    data.options && typeof data.options === "object"
      ? { ...data.options, password: undefined }
      : data.options;
  const createdAt =
    typeof data.created_at === "string"
      ? data.created_at
      : data.createdAt?.toDate?.()?.toISOString?.()
        ?? data.created_at?.toDate?.()?.toISOString?.()
        ?? null;

  return {
    ...data,
    id,
    options: safeOptions,
    created_at: createdAt,
  };
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") || 100);
  const resultLimit = Math.min(Math.max(Math.trunc(requestedLimit), 1), 100);
  const snapshot = await adminDb
    .collection("orders")
    .where("user_id", "==", userId)
    .limit(resultLimit)
    .get();
  const orders = snapshot.docs
    .map((document) => serializeOrder(document.id, document.data()))
    .sort((left, right) =>
      String(right.created_at || "").localeCompare(String(left.created_at || "")),
    );

  return NextResponse.json(
    { success: true, orders },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
