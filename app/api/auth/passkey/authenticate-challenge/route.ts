import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserPasskeys, storeChallenge, getRPConfig } from "@/lib/auth/passkeys";

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();
    if (!userId && !email) {
      return NextResponse.json({ error: "معرف المستخدم مطلوب" }, { status: 400 });
    }

    const passkeys = await getUserPasskeys(userId, email);
    if (!passkeys || passkeys.length === 0) {
      return NextResponse.json({ error: "لا توجد بصمة مسجلة لهذا الحساب" }, { status: 404 });
    }

    const effectiveUserId = passkeys[0].userId;
    const { rpID } = getRPConfig(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((p) => ({
        id: p.passkeyId,
        transports: (p.transports as any) || undefined,
      })),
      userVerification: "preferred",
    });

    await storeChallenge(effectiveUserId, options.challenge);
    if (userId && userId !== effectiveUserId) {
      await storeChallenge(userId, options.challenge);
    }
    if (email && email !== effectiveUserId && email !== userId) {
      await storeChallenge(email, options.challenge);
    }

    return NextResponse.json({
      success: true,
      options,
      effectiveUserId,
    });
  } catch (err: any) {
    console.error("Authenticate challenge error:", err);
    return NextResponse.json({ error: err?.message || "تعذر بدء التحقق من البصمة" }, { status: 500 });
  }
}
