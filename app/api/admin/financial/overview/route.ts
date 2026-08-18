import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { getSarToEgpCustomerRate } from "@/lib/money/exchange-rates";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    // 1. Calculate Customer Balances & Liabilities
    const usersSnap = await adminDb.collection("profiles").where("role", "!=", "admin").get();
    let availableCustomerBalancesUsd = 0;
    const pricingSnap = await adminDb.collection("settings").doc("pricing").get();
    const usdEgpRate = Number(pricingSnap.data()?.usd_rate || pricingSnap.data()?.tiktok_usd_rate || 50);
    const sarEgpRate = await getSarToEgpCustomerRate();
    const customers: Array<Record<string, unknown>> = [];

    usersSnap.forEach(d => {
      const bal = Number(d.data().balance) || 0;
      if (bal > 0) availableCustomerBalancesUsd += bal;
      customers.push({
        id: d.id,
        name: d.data().name || "مستخدم",
        email: d.data().email || "",
        country: d.data().country_code || "EG",
        balanceUsd: bal,
        balanceEgp: bal * usdEgpRate,
        balanceSar: bal * usdEgpRate / sarEgpRate,
      });
    });
    customers.sort((a, b) => Number(b.balanceUsd) - Number(a.balanceUsd));
    
    // As decided, there is no reserved balance because it's deducted immediately.
    const reservedCustomerBalancesUsd = 0;
    const totalCustomerLiabilityUsd = availableCustomerBalancesUsd;

    // 2. Fetch USDT Reserve Settings
    const reserveSnap = await adminDb.collection("settings").doc("reserve").get();
    const reserveData = (reserveSnap.exists ? reserveSnap.data() : {}) ?? {};
    const customerReserveUsdt = Number((reserveData as any).manualReserveUsdt) || 0;

    const coveragePercent = totalCustomerLiabilityUsd > 0 
      ? (customerReserveUsdt / totalCustomerLiabilityUsd) * 100 
      : 0;

    const reserveDifferenceUsd = customerReserveUsdt - totalCustomerLiabilityUsd;
    const reserveSurplusUsd = reserveDifferenceUsd > 0 ? reserveDifferenceUsd : 0;
    const reserveDeficitUsd = reserveDifferenceUsd < 0 ? Math.abs(reserveDifferenceUsd) : 0;

    // 3. Profits and Fees calculation
    // Fetch all recharges
    const rechargesSnap = await adminDb.collection("recharges").get();
    let realizedDepositFeesEgp = 0;
    let approvedDepositsEgp = 0;
    let approvedDepositsUsd = 0;
    rechargesSnap.forEach(d => {
      const data = d.data();
      if (!["approved", "verified"].includes(data.status)) return;
      const gross = Number(data.grossDepositEgp) || 0;
      const net = Number(data.netDepositEgp) || 0;
      realizedDepositFeesEgp += Number(data.depositFeeEgp) || Math.max(0, gross - net);
      approvedDepositsEgp += gross;
      approvedDepositsUsd += Number(data.creditedUsd || data.estimatedCreditUsd) || 0;
    });

    // Fetch all completed orders
    const ordersSnap = await adminDb.collection("orders").get();
    let completedSalesUsd = 0;
    let supplierCostsUsd = 0;
    let serviceGrossProfitUsd = 0;
    let serviceNetProfitUsd = 0;

    let completedOrdersCount = 0;
    let pendingOrdersCount = 0;
    let rejectedOrdersCount = 0;
    ordersSnap.forEach(d => {
      const data = d.data();
      if (["pending", "pending_action"].includes(data.status)) pendingOrdersCount += 1;
      if (["rejected", "cancelled", "canceled"].includes(data.status)) rejectedOrdersCount += 1;
      if (data.status !== "completed") return;
      completedOrdersCount += 1;
      completedSalesUsd += Number(data.saleAmountUsd) || 0;
      supplierCostsUsd += Number(data.supplierCostUsd) || 0;
      serviceGrossProfitUsd += Number(data.grossServiceProfitUsd) || 0;
      serviceNetProfitUsd += Number(data.netServiceProfitUsd) || 0;
    });

    // Expenses
    const expensesSnap = await adminDb.collection("expenses").get();
    let operatingExpensesUsd = 0;
    expensesSnap.forEach(d => {
      operatingExpensesUsd += Number(d.data().amountUsd) || 0;
    });

    // Exchange Margin (Estimated for now until USDT purchase log is completed)
    const realizedExchangeMarginEgp = 0; 
    const estimatedExchangeMarginEgp = 0;
    const walletTransactionsSnap = await adminDb.collection("wallet_transactions").get();
    let refundedOrdersUsd = 0;
    walletTransactionsSnap.forEach((entry) => {
      if (entry.data().type === "refund") refundedOrdersUsd += Number(entry.data().amountUsd) || 0;
    });
    const refundLossesUsd = 0;

    const depositFeesProfitUsd = realizedDepositFeesEgp / usdEgpRate;
    const realizedNetProfitUsd =
      serviceNetProfitUsd + depositFeesProfitUsd - operatingExpensesUsd - refundLossesUsd;

    const safeWithdrawableProfitUsd = Math.max(
      realizedNetProfitUsd, // Simplified version of liquidBusinessAssets - liabilities - pending.
      0
    );

    return NextResponse.json({
      availableCustomerBalancesUsd,
      reservedCustomerBalancesUsd,
      totalCustomerLiabilityUsd,
      customerReserveUsdt,
      coveragePercent,
      reserveSurplusUsd,
      reserveDeficitUsd,
      realizedDepositFeesEgp,
      depositFeesProfitUsd,
      realizedExchangeMarginEgp,
      estimatedExchangeMarginEgp,
      completedSalesUsd,
      supplierCostsUsd,
      serviceGrossProfitUsd,
      serviceNetProfitUsd,
      operatingExpensesUsd,
      refundLossesUsd,
      realizedNetProfitUsd,
      safeWithdrawableProfitUsd,
      usdEgpRate,
      sarEgpRate,
      totalCustomerBalancesEgp: availableCustomerBalancesUsd * usdEgpRate,
      totalCustomerBalancesSar: availableCustomerBalancesUsd * usdEgpRate / sarEgpRate,
      customers,
      customerCount: customers.length,
      approvedDepositsEgp,
      approvedDepositsUsd,
      refundedOrdersUsd,
      completedOrdersCount,
      pendingOrdersCount,
      rejectedOrdersCount,
      dataCompletenessStatus: "live"
    });

  } catch (error: any) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Overview API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
