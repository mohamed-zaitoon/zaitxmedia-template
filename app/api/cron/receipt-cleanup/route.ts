import { NextResponse } from "next/server";
import { runReceiptAutoDelete } from "@/lib/receipt-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReceiptAutoDelete();
    return NextResponse.json({
      success: true,
      result,
      message: `تم فحص الإيصالات تلقائياً: تم حذف ${result.deleted} إيصال من R2 وباقي ${result.failed} إيصالات فشل حذفها.`,
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Receipt cleanup cron error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Receipt cleanup cron failed" },
      { status: 500 },
    );
  }
}

export const POST = GET;
