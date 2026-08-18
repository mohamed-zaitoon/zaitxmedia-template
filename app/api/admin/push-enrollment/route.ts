import { NextResponse } from "next/server";
import {
  adminAuthErrorResponse,
  createAdminPushEnrollmentToken,
  requireAdmin,
} from "@/lib/auth/admin";

export async function GET() {
  try {
    await requireAdmin();
    const token = await createAdminPushEnrollmentToken();
    return NextResponse.json({
      success: true,
      url: `https://zaitxmedia.com/notifications/admin-enroll#token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    return NextResponse.json({ success: false, error: "Unable to create enrollment" }, { status: 500 });
  }
}
