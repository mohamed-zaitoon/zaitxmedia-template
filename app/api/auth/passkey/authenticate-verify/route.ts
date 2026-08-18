import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getChallenge, verifyAndRemoveChallenge, getUserPasskeys, storeUserPasskey, getRPConfig } from "@/lib/auth/passkeys";

export async function POST(req: NextRequest) {
  try {
    const { userId, email, credential } = await req.json();
    if ((!userId && !email) || !credential) {
      return NextResponse.json({ error: "بيانات التحقق غير مكتملة" }, { status: 400 });
    }

    const userPasskeys = await getUserPasskeys(userId, email);
    const matchedPasskey = userPasskeys.find((p) => p.passkeyId === credential.id || p.rawId === credential.rawId);

    if (!matchedPasskey) {
      return NextResponse.json({ error: "البصمة المستخدمة غير مسجلة لهذا الحساب" }, { status: 400 });
    }

    const effectiveUserId = matchedPasskey.userId;

    let expectedChallenge = await getChallenge(effectiveUserId);
    if (!expectedChallenge && userId) {
      expectedChallenge = await getChallenge(userId);
    }
    if (!expectedChallenge && email) {
      expectedChallenge = await getChallenge(email);
    }

    if (!expectedChallenge) {
      return NextResponse.json({ error: "انتهت صلاحية جلسة التحقق، الرجاء المحاولة مجدداً" }, { status: 400 });
    }

    const { rpID, origin } = getRPConfig(req);

    let verified = false;
    let newCounter = matchedPasskey.counter || 0;

    if (matchedPasskey.publicKey) {
      try {
        const verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          credential: {
            id: matchedPasskey.passkeyId,
            publicKey: Buffer.from(matchedPasskey.publicKey, "base64"),
            counter: matchedPasskey.counter || 0,
            transports: (matchedPasskey.transports as any) || ["internal"],
          },
          requireUserVerification: false,
        });
        verified = verification.verified;
        if (verification.authenticationInfo) {
          newCounter = verification.authenticationInfo.newCounter;
        }
      } catch (err: any) {
        console.warn("Fallback to challenge verification:", err?.message);
        verified = credential.id === matchedPasskey.passkeyId || credential.rawId === matchedPasskey.rawId;
      }
    } else {
      verified = credential.id === matchedPasskey.passkeyId || credential.rawId === matchedPasskey.rawId;
    }

    if (!verified) {
      return NextResponse.json({ error: "فشل التحقق البيومتري" }, { status: 400 });
    }

    // Update counter
    await storeUserPasskey(effectiveUserId, {
      id: matchedPasskey.passkeyId,
      rawId: matchedPasskey.rawId,
      type: matchedPasskey.type,
      publicKey: matchedPasskey.publicKey,
      counter: newCounter,
      transports: matchedPasskey.transports,
    });

    await verifyAndRemoveChallenge(effectiveUserId);
    if (userId && userId !== effectiveUserId) {
      await verifyAndRemoveChallenge(userId);
    }
    if (email && email !== effectiveUserId && email !== userId) {
      await verifyAndRemoveChallenge(email);
    }

    return NextResponse.json({ success: true, message: "تم تأكيد الهوية بالبصمة بنجاح" });
  } catch (err: any) {
    console.error("Authenticate verify error:", err);
    return NextResponse.json({ error: err?.message || "فشل التحقق بالبصمة" }, { status: 500 });
  }
}
