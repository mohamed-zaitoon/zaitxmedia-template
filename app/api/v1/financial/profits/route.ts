import { AggregateField } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { requireAdmin } from "@/lib/auth/admin";
import { money } from "@/lib/financial/model";

function startForPeriod(period: string, request: NextRequest): Date | null {
  const now = new Date();
  if (period === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week" || period === "7d") return new Date(Date.now() - 7 * 86_400_000);
  if (period === "month" || period === "30d") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "year") return new Date(now.getFullYear(), 0, 1);
  if (period === "custom") {
    const value = request.nextUrl.searchParams.get("dateFrom");
    const parsed = value ? new Date(value) : null;
    return parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const period = request.nextUrl.searchParams.get("period") || "all";
    const dateFrom = startForPeriod(period, request);
    const dateToValue = request.nextUrl.searchParams.get("dateTo");
    const dateTo = dateToValue ? new Date(dateToValue) : null;
    let ordersQuery: FirebaseFirestore.Query = adminDb
      .collection("orders")
      .where("status", "==", "completed");
    let depositsQuery: FirebaseFirestore.Query = adminDb
      .collection("recharges")
      .where("status", "in", ["approved", "verified"]);
    if (dateFrom) {
      ordersQuery = ordersQuery.where("createdAt", ">=", dateFrom);
      depositsQuery = depositsQuery.where("createdAt", ">=", dateFrom);
    }
    if (dateTo && Number.isFinite(dateTo.getTime())) {
      ordersQuery = ordersQuery.where("createdAt", "<=", dateTo);
      depositsQuery = depositsQuery.where("createdAt", "<=", dateTo);
    }

    const [orders, deposits, services, customers, methods] = await Promise.all([
      ordersQuery.aggregate({
        count: AggregateField.count(),
        salesUsd: AggregateField.sum("saleAmountUsd"),
        costsUsd: AggregateField.sum("supplierCostUsd"),
        profitUsd: AggregateField.sum("netServiceProfitUsd"),
      }).get(),
      depositsQuery.aggregate({
        count: AggregateField.count(),
        feesEgp: AggregateField.sum("depositFeeEgp"),
        feesSar: AggregateField.sum("depositFeeSar"),
        costsEgp: AggregateField.sum("processingCostEgp"),
        costsSar: AggregateField.sum("processingCostSar"),
        profitEgp: AggregateField.sum("depositProfitEgp"),
        profitSar: AggregateField.sum("depositProfitSar"),
      }).get(),
      adminDb.collection("financial_profit_dimensions")
        .where("dimension", "==", "service").orderBy("profitUsd", "desc").limit(10).get(),
      adminDb.collection("financial_profit_dimensions")
        .where("dimension", "==", "customer").orderBy("profitUsd", "desc").limit(10).get(),
      adminDb.collection("financial_profit_dimensions")
        .where("dimension", "==", "payment_method").orderBy("profit", "desc").limit(10).get(),
    ]);
    const orderData = orders.data();
    const depositData = deposits.data();
    const mapDimension = (snapshot: FirebaseFirestore.QuerySnapshot) =>
      snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));

    return NextResponse.json({
      success: true,
      period,
      profits: {
        orders: { USD: money(orderData.profitUsd), EGP: 0, SAR: 0 },
        deposits: { USD: 0, EGP: money(depositData.profitEgp), SAR: money(depositData.profitSar) },
        total: {
          USD: money(orderData.profitUsd),
          EGP: money(depositData.profitEgp),
          SAR: money(depositData.profitSar),
        },
      },
      sales: { USD: money(orderData.salesUsd), EGP: 0, SAR: 0 },
      costs: {
        USD: money(orderData.costsUsd),
        EGP: money(depositData.costsEgp),
        SAR: money(depositData.costsSar),
      },
      counts: { orders: orderData.count, deposits: depositData.count },
      mostProfitable: {
        services: mapDimension(services),
        customers: mapDimension(customers),
        paymentMethods: mapDimension(methods),
      },
    });
  } catch (error) {
    console.error("Financial profits error", error);
    return NextResponse.json({ success: false, error: "تعذر تحميل الأرباح" }, { status: 500 });
  }
}
