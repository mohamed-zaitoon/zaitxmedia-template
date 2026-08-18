import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { verifyAdminToken, parseQueryInt } from "@/lib/financial/auth";

const n = (v: any) => Number(v) || 0;

function dateMillis(value: any): number {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isoDate(value: any): string | null {
  const millis = dateMillis(value);
  return millis > 0 ? new Date(millis).toISOString() : null;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminToken(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = parseQueryInt(searchParams.get("page"), 1);
    const limitNum = Math.min(parseQueryInt(searchParams.get("limit"), 50), 200);
    const statusFilter = searchParams.get("status") || "";
    const currencyFilter = searchParams.get("currency") || "";
    const userIdFilter = searchParams.get("userId") || "";

    const snap = await adminDb.collection("orders").get();

    const pricingSnap = await adminDb.collection("settings").doc("pricing").get();
    const usdToEgp = n(pricingSnap.data()?.usd_rate || 50);

    const matchingDocuments = snap.docs
      .filter((doc) => {
        const data = doc.data();
        if (userIdFilter && String(data.user_id || data.userId || "") !== userIdFilter) return false;
        if (statusFilter && String(data.status || "") !== statusFilter) return false;
        if (currencyFilter && String(data.currency || "EGP") !== currencyFilter) return false;
        return true;
      })
      .sort((left, right) => {
        const leftData = left.data();
        const rightData = right.data();
        return dateMillis(rightData.createdAt || rightData.created_at)
          - dateMillis(leftData.createdAt || leftData.created_at);
      });

    const totals = matchingDocuments.reduce((result, doc) => {
      const data = doc.data();
      const saleUsd = n(data.saleAmountUsd)
        || (n(data.price) > 0 && usdToEgp > 0 ? n(data.price) / usdToEgp : 0);
      const costUsd = n(data.supplierCostUsd);
      const profitUsd = n(data.netServiceProfitUsd || data.profitUsd);
      result.salesUsd += saleUsd;
      result.costsUsd += costUsd;
      result.profitsUsd += profitUsd;
      return result;
    }, { salesUsd: 0, costsUsd: 0, profitsUsd: 0 });

    const pageDocuments = matchingDocuments.slice((page - 1) * limitNum, page * limitNum);
    const orders: any[] = [];
    pageDocuments.forEach((doc: any) => {
      const d = doc.data();
      const saleUsd = n(d.saleAmountUsd)
        || (n(d.price) > 0 && usdToEgp > 0 ? n(d.price) / usdToEgp : 0);
      const costUsd = n(d.supplierCostUsd);
      const profit = n(d.netServiceProfitUsd || d.profitUsd);
      const currency = d.currency || "EGP";

      orders.push({
        id: doc.id,
        userId: d.user_id || d.userId || "",
        userName: d.user_email || d.user_name || "",
        serviceName: d.service_name || d.serviceName || "",
        serviceId: d.service_id || "",
        quantity: n(d.quantity) || 1,
        currency,
        saleAmountUsd: saleUsd,
        saleAmountEgp: saleUsd * usdToEgp,
        supplierPriceUsd: n(d.supplierPriceUsd),
        supplierPricingBasis: d.supplierPricingBasis || null,
        supplierCostUsd: costUsd,
        supplierCostLocal: n(d.supplierCostLocal),
        netProfitUsd: profit,
        netProfitEgp: n(d.profitLocal) || profit * usdToEgp,
        paymentFee: n(d.paymentFee),
        discountAmount: n(d.discountAmount),
        refundAmount: n(d.refundedUsd),
        status: d.status || "unknown",
        paymentMode: d.paymentMode || "",
        createdAt: isoDate(d.createdAt || d.created_at),
        completedAt: isoDate(d.completedAt || d.completed_at),
      });
    });
    const total = matchingDocuments.length;

    return NextResponse.json({
      success: true,
      data: orders,
      totals,
      pagination: {
        page,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });

  } catch (err: any) {
    console.error("Financial orders error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
