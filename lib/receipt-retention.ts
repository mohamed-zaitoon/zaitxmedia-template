import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/**
 * Deletes a receipt image from Cloudflare R2 storage given its URL or Key.
 */
export async function deleteCloudflareReceipt(receiptUrlOrKey: string): Promise<boolean> {
  if (!receiptUrlOrKey) return true;
  try {
    let key = receiptUrlOrKey;
    if (key.includes("/storage/")) {
      key = key.substring(key.indexOf("/storage/") + "/storage/".length);
    }
    key = key.trim();
    if (!key) return true;

    const workerUrl = "https://api.zaitxmedia.com/api/internal/delete";
    const internalSecret = process.env.INTERNAL_API_SECRET || "dev_secret_fallback";

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "x-internal-secret": internalSecret,
        "content-type": "application/json",
        "x-file-key": key,
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to delete R2 object (${key}):`, response.status, errText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Cloudflare receipt deletion error:", error);
    return false;
  }
}

/**
 * Calculates auto-deletion schedule timestamp (15 minutes from now).
 */
export function getReceiptAutoDeleteTimestamp(delayMs = FIFTEEN_MINUTES_MS): string {
  return new Date(Date.now() + delayMs).toISOString();
}

/**
 * Sweeps all recharges with expired receipts (receipt_delete_at <= now)
 * and permanently deletes the receipt file from Cloudflare R2 and clears DB reference.
 */
export async function runReceiptAutoDelete(): Promise<{
  scanned: number;
  deleted: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  let scanned = 0;
  let deleted = 0;
  let failed = 0;

  try {
    const snap = await adminDb
      .collection("recharges")
      .where("receipt_deleted_at", "==", null)
      .limit(100)
      .get();

    scanned = snap.size;
    if (snap.empty) return { scanned: 0, deleted: 0, failed: 0 };

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const receiptUrl = data.receiptUrl || data.receipt_url;
      const receiptDeleteAt = data.receipt_delete_at || data.receiptDeleteAt;

      // Only delete if receipt exists, has auto-delete timestamp, and timestamp <= now
      if (!receiptUrl || !receiptDeleteAt || receiptDeleteAt > nowIso) {
        continue;
      }

      // Perform Cloudflare R2 permanent object deletion
      const success = await deleteCloudflareReceipt(receiptUrl);

      if (success) {
        // Clear DB references and mark receipt as deleted
        await docSnap.ref.update({
          receiptUrl: null,
          receipt_url: null,
          receiptKey: null,
          receipt_key: null,
          receipt_status: "deleted",
          receipt_deleted_at: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        deleted++;
      } else {
        failed++;
        console.error(`Failed to auto-delete receipt for recharge document ${docSnap.id}`);
      }
    }
  } catch (err) {
    console.error("Error in runReceiptAutoDelete:", err);
  }

  return { scanned, deleted, failed };
}
