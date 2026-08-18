import { NextResponse } from "next/server";
import { db } from "../../../../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export async function GET(request: Request) {
  try {
    const configuredSecret = process.env.INTERNAL_API_SECRET;
    const suppliedSecret = request.headers.get("x-internal-secret") || request.headers.get("Authorization");
    
    // Connectivity ping from Android gateway app
    if (!suppliedSecret) {
      return NextResponse.json({
        success: true,
        status: "online",
        serverTime: new Date().toISOString(),
        nextExpectedHeartbeatSeconds: 60,
      });
    }

    if (configuredSecret && suppliedSecret !== configuredSecret && suppliedSecret !== `Bearer ${configuredSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const gatewayRef = doc(db, "settings", "sms_gateway");
    
    await setDoc(
      gatewayRef,
      {
        id: "primary_gateway",
        lastHeartbeatAt: serverTimestamp(),
        lastKnownStatus: "online",
        userAgent: request.headers.get("user-agent") || "unknown",
        // Extract a masked IP for security context
        lastIpMasked: (request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "unknown").split(".")[0] + ".***.***.***",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      status: "online",
      serverTime: new Date().toISOString(),
      nextExpectedHeartbeatSeconds: 60,
    });
  } catch (error) {
    console.error("Heartbeat error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
