import { adminDb } from "./app/lib/firebase-admin";

async function runTest() {
  const userId = "test_user_123";
  const orderId = "test_order_123";
  
  // 1. Create a dummy profile
  await adminDb.collection("profiles").doc(userId).set({
    name: "Test User",
    email: "test@example.com",
    balance: 10,
    role: "user"
  });

  // 2. Create a dummy order
  const orderRef = adminDb.collection("orders").doc(orderId);
  await orderRef.set({
    user_id: userId,
    price: 500,
    saleAmountUsd: 10,
    lockedExchangeRateEgp: 50,
    balance_deducted: true,
    paymentMode: "wallet_balance",
    status: "pending"
  });

  console.log("Created test order and user. Now attempting to reject...");

  try {
    let refundedUsd = 0;
    const adminId = "admin_pin";
    
    await adminDb.runTransaction(async (transaction) => {
      const order = await transaction.get(orderRef);
      if (!order.exists) throw new Error("ORDER_NOT_FOUND");
      const data = order.data()!;

      const isWalletPayment = data.balance_deducted === true || data.paymentMode === "wallet_balance";

      if (isWalletPayment) {
        if (!data.user_id) throw new Error("الطلب لا يحتوي على معرف مستخدم صالح لإرجاع الرصيد.");
        const profileRef = adminDb.collection("profiles").doc(data.user_id);
        const profile = await transaction.get(profileRef);
        if (!profile.exists) throw new Error("PROFILE_NOT_FOUND");

        let calculatedRefund = Number(data.saleAmountUsd);
        if (isNaN(calculatedRefund) || calculatedRefund === 0) {
          calculatedRefund = (Number(data.price) || 0) / (Number(data.lockedExchangeRateEgp) || 50);
        }
        refundedUsd = isNaN(calculatedRefund) ? 0 : calculatedRefund;

        const balanceBeforeUsd = Number(profile.data()?.balance) || 0;
        const balanceAfterUsd = Number((balanceBeforeUsd + refundedUsd).toFixed(6));
        const walletTransactionRef = adminDb.collection("wallet_transactions").doc();

        transaction.update(profileRef, { balance: balanceAfterUsd });
        transaction.create(walletTransactionRef, {
          userId: data.user_id,
          orderId: orderId,
          type: "refund",
          amountUsd: refundedUsd,
          amountEgp: Number(data.price) || 0,
          exchangeRateEgp: Number(data.lockedExchangeRateEgp) || 50,
          balanceBeforeUsd,
          balanceAfterUsd,
          description: `استرداد الطلب المرفوض #${orderId.slice(0, 8)}`
        });
      }

      transaction.update(orderRef, {
        status: "rejected",
        fulfillmentStatus: "rejected",
        balance_refunded: isWalletPayment,
        refundedUsd,
        rejectedBy: adminId,
      });
    });
    
    console.log("Success! Refunded USD:", refundedUsd);
    
    // Check balance
    const p = await adminDb.collection("profiles").doc(userId).get();
    console.log("Final balance:", p.data()?.balance);

  } catch (e: any) {
    console.error("Failed to reject:", e.message);
  }
}

runTest();
