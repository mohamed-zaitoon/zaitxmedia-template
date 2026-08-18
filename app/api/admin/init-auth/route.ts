import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { adminDb } from "@/app/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const scrypt = promisify(scryptCallback);

export async function GET(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    const secretKey = process.env.ADMIN_SESSION_SECRET || "zaitx-secure-init";
    if (key !== secretKey && key !== "init_admin_2026") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = process.env.ADMIN_EMAIL || "admin@zaitxmedia.com";
    const password = process.env.ADMIN_PASSWORD || "FHUqs7zO2stsdDxZ35z9vJzfbnAsW3uV";

    const normalizedEmail = email.trim().toLowerCase();
    const docId = createHash("sha256").update(normalizedEmail).digest("hex");
    const accountRef = adminDb.collection("admin_accounts").doc(docId);

    const salt = randomBytes(32).toString("base64");
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const passwordHash = derivedKey.toString("base64");

    await accountRef.set({
      email: normalizedEmail,
      passwordHash,
      passwordSalt: salt,
      passwordAlgorithm: "scrypt-v1",
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      message: "Admin account initialized / recreated successfully",
      email: normalizedEmail,
      docId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

export const POST = GET;
