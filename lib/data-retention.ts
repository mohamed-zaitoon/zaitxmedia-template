import { adminDb } from "@/app/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_USER_ITEMS = 30;

/**
 * Enforces per-user limit of max 30 items for orders, recharges, or notifications.
 * Deletes the oldest items if user exceeds 30.
 */
export async function enforceUserLimit(
  collectionName: "orders" | "recharges" | "notifications",
  userId: string,
  maxAllowed = MAX_USER_ITEMS
): Promise<number> {
  if (!userId) return 0;
  try {
    const userField = collectionName === "orders" ? "user_id" : "userId";
    const snap = await adminDb
      .collection(collectionName)
      .where(userField, "==", userId)
      .get();

    if (snap.size <= maxAllowed) return 0;

    // Sort by createdAt ascending (oldest first)
    const sortedDocs = snap.docs.sort((a, b) => {
      const aData = a.data();
      const bData = b.data();
      const aTime = aData.createdAt?.toMillis?.() || aData.createdAt?.toDate?.()?.getTime() || new Date(aData.createdAt || aData.created_at || 0).getTime();
      const bTime = bData.createdAt?.toMillis?.() || bData.createdAt?.toDate?.()?.getTime() || new Date(bData.createdAt || bData.created_at || 0).getTime();
      return aTime - bTime;
    });

    const excessCount = snap.size - maxAllowed;
    const batch = adminDb.batch();
    for (let i = 0; i < excessCount; i++) {
      batch.delete(sortedDocs[i].ref);
    }
    await batch.commit();
    return excessCount;
  } catch (err) {
    console.error(`Error enforcing ${collectionName} limit for user ${userId}:`, err);
    return 0;
  }
}

/**
 * Sweeps all orders, recharges, and notifications:
 * 1. Deletes entries older than 30 days.
 * 2. Enforces max 30 items per user across orders, recharges, and notifications.
 * NEVER deletes accounting ledger, wallet transactions, or financial audit logs.
 */
export async function runGlobalCleanup(): Promise<{
  deleted30Days: { orders: number; recharges: number; notifications: number };
  userLimitsEnforced: number;
}> {
  const cutoff = Timestamp.fromMillis(Date.now() - THIRTY_DAYS_MS);
  let ordersDel = 0, rechargesDel = 0, notifsDel = 0;

  // 1. Delete items older than 30 days
  const [ordersSnap, rechargesSnap, notifsSnap] = await Promise.all([
    adminDb.collection("orders").where("createdAt", "<", cutoff).get(),
    adminDb.collection("recharges").where("createdAt", "<", cutoff).get(),
    adminDb.collection("notifications").where("createdAt", "<", cutoff).get(),
  ]);

  if (!ordersSnap.empty) {
    const b = adminDb.batch();
    ordersSnap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    ordersDel = ordersSnap.size;
  }

  if (!rechargesSnap.empty) {
    const b = adminDb.batch();
    rechargesSnap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    rechargesDel = rechargesSnap.size;
  }

  if (!notifsSnap.empty) {
    const b = adminDb.batch();
    notifsSnap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    notifsDel = notifsSnap.size;
  }

  // 2. Enforce per-user limits for remaining active items
  let limitsEnforced = 0;

  // Group remaining active items by user and enforce limit
  const activeOrders = await adminDb.collection("orders").get();
  const userOrdersMap = new Map<string, number>();
  activeOrders.docs.forEach((doc) => {
    const uid = doc.data().user_id || doc.data().userId;
    if (uid) userOrdersMap.set(uid, (userOrdersMap.get(uid) || 0) + 1);
  });

  for (const [uid, count] of userOrdersMap.entries()) {
    if (count > MAX_USER_ITEMS) {
      limitsEnforced += await enforceUserLimit("orders", uid, MAX_USER_ITEMS);
    }
  }

  const activeRecharges = await adminDb.collection("recharges").get();
  const userRechargesMap = new Map<string, number>();
  activeRecharges.docs.forEach((doc) => {
    const uid = doc.data().userId || doc.data().user_id;
    if (uid) userRechargesMap.set(uid, (userRechargesMap.get(uid) || 0) + 1);
  });

  for (const [uid, count] of userRechargesMap.entries()) {
    if (count > MAX_USER_ITEMS) {
      limitsEnforced += await enforceUserLimit("recharges", uid, MAX_USER_ITEMS);
    }
  }

  const activeNotifs = await adminDb.collection("notifications").get();
  const userNotifsMap = new Map<string, number>();
  activeNotifs.docs.forEach((doc) => {
    const uid = doc.data().userId;
    if (uid) userNotifsMap.set(uid, (userNotifsMap.get(uid) || 0) + 1);
  });

  for (const [uid, count] of userNotifsMap.entries()) {
    if (count > MAX_USER_ITEMS) {
      limitsEnforced += await enforceUserLimit("notifications", uid, MAX_USER_ITEMS);
    }
  }

  return {
    deleted30Days: { orders: ordersDel, recharges: rechargesDel, notifications: notifsDel },
    userLimitsEnforced: limitsEnforced,
  };
}
