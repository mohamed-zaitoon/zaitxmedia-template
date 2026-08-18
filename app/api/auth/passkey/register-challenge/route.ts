import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { storeChallenge, getRPConfig, getUserPasskeys } from "@/lib/auth/passkeys";
import { adminDb } from "@/app/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { userId, userRole } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "الرجاء تحديد معرف المستخدم" }, { status: 400 });
    }

    const { rpID, rpName } = getRPConfig(req);

    let displayName = "مستخدم ZAITX";
    let username = userId;
    let email = "";

    try {
      const profileSnap = await adminDb.collection("profiles").doc(userId).get();
      if (profileSnap.exists) {
        const data = profileSnap.data() || {};
        displayName = data.name || data.username || "مستخدم ZAITX";
        username = data.username ? `@${data.username}` : (data.email || userId);
        email = data.email || "";
      }
    } catch (e) {
      console.warn("Could not load profile for passkey challenge", e);
    }

    const existingPasskeys = await getUserPasskeys(userId);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(userId),
      userName: username || email || userId,
      userDisplayName: displayName,
      attestationType: "none",
      excludeCredentials: existingPasskeys.map((p) => ({
        id: p.passkeyId,
        transports: (p.transports as any) || undefined,
      })),
      authenticatorSelection: {
        userVerification: "preferred",
        residentKey: "preferred",
      },
    });

    await storeChallenge(userId, options.challenge);

    return NextResponse.json({
      success: true,
      options,
    });
  } catch (err: any) {
    console.error("Register challenge error:", err);
    return NextResponse.json({ error: err?.message || "خطأ في خادم البصمة" }, { status: 500 });
  }
}
