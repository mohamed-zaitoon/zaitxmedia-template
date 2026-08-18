import { NextResponse } from "next/server";
import { runGlobalCleanup } from "@/lib/data-retention";
import { runReceiptAutoDelete } from "@/lib/receipt-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  
  // Allow execution if authorized or in cron context
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [result, receiptResult] = await Promise.all([
      runGlobalCleanup(),
      runReceiptAutoDelete(),
    ]);
    return NextResponse.json({
      success: true,
      ...result,
      receiptCleanup: receiptResult,
      rules: {
        maxItemsPerUser: 30,
        retentionDays: 30,
        protected: ["financial_ledger", "wallet_transactions", "financial_assets", "profiles"],
      },
      completedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Cleanup error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Cleanup failed" }, { status: 500 });
  }
}

export const POST = GET;
