import { NextResponse } from "next/server";
import { verifyAdminPushEnrollmentToken } from "@/lib/auth/admin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const valid = token ? await verifyAdminPushEnrollmentToken(token) : false;
  return NextResponse.json(
    { success: valid },
    { status: valid ? 200 : 401 },
  );
}
