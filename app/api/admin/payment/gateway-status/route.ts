import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function GET() {
  try {
    await requireAdmin();

    const gatewaySnap = await adminDb.collection("settings").doc("sms_gateway").get();
    
    if (!gatewaySnap.exists) {
      return NextResponse.json({
        success: true,
        gateway: {
          status: "offline",
          lastHeartbeatAt: null,
          secondsSinceLastHeartbeat: -1
        }
      });
    }

    const data = gatewaySnap.data()!;
    const lastHeartbeatTime = data.lastHeartbeatAt?.toMillis() || 0;
    const now = Date.now();
    const secondsSinceLastHeartbeat = Math.floor((now - lastHeartbeatTime) / 1000);

    let status = "online";
    if (secondsSinceLastHeartbeat > 300) {
      status = "offline";
    } else if (secondsSinceLastHeartbeat > 120) {
      status = "delayed";
    }

    return NextResponse.json({
      success: true,
      gateway: {
        status,
        lastHeartbeatAt: lastHeartbeatTime ? new Date(lastHeartbeatTime).toISOString() : null,
        secondsSinceLastHeartbeat
      }
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Gateway status error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
