import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { FieldValue } from "firebase-admin/firestore";

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
    const snapshot = await adminDb.collection("profiles").get();
    const users: Array<Record<string, unknown> & { id: string }> = snapshot.docs
      .map((document): Record<string, unknown> & { id: string } => ({
        id: document.id,
        ...document.data(),
      }))
      .sort((left, right) => (
        timestampValue(right.created_at ?? right.createdAt)
        - timestampValue(left.created_at ?? left.createdAt)
      ))
      .slice(0, 500);

    return NextResponse.json({ success: true, users });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to load admin users", error);
    return NextResponse.json(
      { success: false, error: "Unable to load users" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const input = await request.json().catch(() => null);
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return NextResponse.json({ success: false, error: "Invalid user update" }, { status: 400 });
    }

    const { id } = input as { id?: unknown };
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ success: false, error: "User id is required" }, { status: 400 });
    }

    const profileRef = adminDb.collection("profiles").doc(id);
    const updates: Record<string, unknown> = {};

    // 1. Account Ban / Unban
    if (typeof (input as any).banned === "boolean") {
      updates.banned = (input as any).banned;
      updates.ban_reason = String((input as any).ban_reason || "").trim().slice(0, 500);
    }

    // 2. IP Ban / Unban
    if (typeof (input as any).ban_ip === "string" && (input as any).ban_ip.trim()) {
      const ipToBan = String((input as any).ban_ip).trim();
      const reason = String((input as any).ban_reason || "حظر يدوي من الإدارة").trim();
      const bannedIpsRef = adminDb.collection("settings").doc("banned_ips");
      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(bannedIpsRef);
        const list = (snap.exists && Array.isArray(snap.data()?.ips)) ? snap.data()!.ips : [];
        if (!list.includes(ipToBan)) {
          list.push(ipToBan);
          t.set(bannedIpsRef, { ips: list, updatedAt: new Date().toISOString() }, { merge: true });
        }
      });
      updates.banned = true;
      updates.banned_ip = ipToBan;
      updates.ban_reason = reason;
    }

    if (typeof (input as any).unban_ip === "string" && (input as any).unban_ip.trim()) {
      const ipToUnban = String((input as any).unban_ip).trim();
      const bannedIpsRef = adminDb.collection("settings").doc("banned_ips");
      await adminDb.runTransaction(async (t) => {
        const snap = await t.get(bannedIpsRef);
        if (snap.exists && Array.isArray(snap.data()?.ips)) {
          const list = snap.data()!.ips.filter((ip: string) => ip !== ipToUnban);
          t.set(bannedIpsRef, { ips: list, updatedAt: new Date().toISOString() }, { merge: true });
        }
      });
    }

    // 3. User Role
    if ((input as any).role !== undefined) {
      const role = String((input as any).role);
      if (!new Set(["user", "admin", "finance"]).has(role)) {
        return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
      }
      if (role === "admin") {
        const existingAdmins = await adminDb.collection("profiles").where("role", "==", "admin").get();
        const anotherAdminExists = existingAdmins.docs.some((document) => document.id !== id);
        if (anotherAdminExists) {
          return NextResponse.json(
            { success: false, error: "يوجد مدير واحد بالفعل" },
            { status: 409 },
          );
        }
      }
      updates.role = role;
    }

    // 4. Editable Fields (Name, WhatsApp, Country Code)
    if (typeof (input as any).name === "string") {
      updates.name = String((input as any).name).trim().slice(0, 100);
    }
    if (typeof (input as any).whatsapp === "string") {
      updates.whatsapp = String((input as any).whatsapp).trim().slice(0, 40);
    }
    if (typeof (input as any).country_code === "string") {
      updates.country_code = String((input as any).country_code).trim().slice(0, 10);
    }

    // 5. Direct Balance Modification (set, add, deduct)
    if ((input as any).balance_action) {
      const balanceAction = String((input as any).balance_action);
      const amountUsd = Number((input as any).amountUsd ?? (input as any).amount);
      const reason = String((input as any).reason || "تعديل رصيد يدوي من الإدارة").trim().slice(0, 300);

      if (!Number.isFinite(amountUsd) || amountUsd < 0) {
        return NextResponse.json({ success: false, error: "المبلغ المدخل غير صحيح" }, { status: 400 });
      }

      await adminDb.runTransaction(async (transaction) => {
        const profileSnap = await transaction.get(profileRef);
        if (!profileSnap.exists) throw new Error("PROFILE_NOT_FOUND");
        const currentBalance = Number(profileSnap.data()?.balance) || 0;
        let newBalance = currentBalance;

        if (balanceAction === "set_balance") {
          newBalance = Number(amountUsd.toFixed(6));
        } else if (balanceAction === "add_balance") {
          newBalance = Number((currentBalance + amountUsd).toFixed(6));
        } else if (balanceAction === "deduct_balance") {
          newBalance = Number(Math.max(0, currentBalance - amountUsd).toFixed(6));
        } else {
          throw new Error("INVALID_BALANCE_ACTION");
        }

        transaction.update(profileRef, {
          balance: newBalance,
          "balances.USD": newBalance,
          financialSchemaVersion: 2,
          updatedAt: new Date().toISOString(),
        });

        // Record Audit Wallet Transaction
        const walletTxRef = adminDb.collection("wallet_transactions").doc();
        transaction.create(walletTxRef, {
          userId: id,
          currency: "USD",
          amount: Number(Math.abs(newBalance - currentBalance).toFixed(6)),
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          type: balanceAction === "deduct_balance" ? "admin_deduct" : "admin_credit",
          description: `${reason} (بواسطة ${admin.email})`,
          immutable: true,
          schemaVersion: 2,
          createdAt: FieldValue.serverTimestamp(),
          createdBy: admin.userId,
        });
      });

      return NextResponse.json({ success: true, message: "تم تعديل الرصيد بنجاح" });
    }

    if (Object.keys(updates).length > 0) {
      await profileRef.set(
        { ...updates, updatedAt: new Date().toISOString() },
        { merge: true },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to update admin user", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unable to update user" },
      { status: 500 },
    );
  }
}
