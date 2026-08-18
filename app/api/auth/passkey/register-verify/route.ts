import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getChallenge, verifyAndRemoveChallenge, storeUserPasskey, getRPConfig } from "@/lib/auth/passkeys";

export async function POST(req: NextRequest) {
  try {
    const { userId, email, credential } = await req.json();
    if ((!userId && !email) || !credential) {
      return NextResponse.json({ error: "بيانات البصمة غير مكتملة" }, { status: 400 });
    }

    const expectedChallenge = (userId ? await getChallenge(userId) : null) || (email ? await getChallenge(email) : null);
    if (!expectedChallenge) {
      return NextResponse.json({ error: "انتهت صلاحية الجلسة، الرجاء المحاولة مجدداً" }, { status: 400 });
    }

    const { rpID, origin } = getRPConfig(req);

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "فشل التحقق من صحة التوقيع البيومتري" }, { status: 400 });
    }

    const { credential: credInfo } = verification.registrationInfo;
    const targetUserId = userId || email;

    await storeUserPasskey(targetUserId, {
      id: credInfo.id,
      rawId: credential.rawId || credInfo.id,
      type: credential.type || "public-key",
      publicKey: Buffer.from(credInfo.publicKey).toString("base64"),
      counter: credInfo.counter,
      transports: credential.response?.transports || ["internal"],
      email: email || "",
    });

    if (userId) await verifyAndRemoveChallenge(userId);
    if (email && email !== userId) await verifyAndRemoveChallenge(email);

    return NextResponse.json({ success: true, message: "تم تسجيل البصمة بنجاح" });
  } catch (err: any) {
    console.error("Register verify error:", err);
    return NextResponse.json({ error: err?.message || "تعذر تفعيل البصمة" }, { status: 500 });
  }
}
