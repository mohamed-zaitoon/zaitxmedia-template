import { NextResponse } from "next/server";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";
import { sendOneSignalPush } from "@/app/utils/onesignal";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { userId, title, body } = await request.json();

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const data = await sendOneSignalPush(userId, title, body);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("OneSignal Error:", error);
    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
