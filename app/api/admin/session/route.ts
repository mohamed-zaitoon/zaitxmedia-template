import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  adminAuthErrorResponse,
  authenticateAdmin,
  createAdminSessionToken,
  requireAdmin,
} from "@/lib/auth/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const admin = await authenticateAdmin(
      typeof body.email === "string" ? body.email : "",
      typeof body.password === "string" ? body.password : "",
    );
    const response = NextResponse.json({
      success: true,
      admin: { id: admin.userId, email: admin.email },
    });
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      await createAdminSessionToken(admin),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ADMIN_SESSION_TTL_SECONDS,
      },
    );
    return response;
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to create admin session", error);
    return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Unable to create admin session" } },
        { status: 500 },
      );
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const response = NextResponse.json({
      success: true,
      admin: { id: admin.userId, email: admin.email },
    });
    // Extend the session on each verification check (rolling session)
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      await createAdminSessionToken(admin),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: ADMIN_SESSION_TTL_SECONDS,
      },
    );
    return response;
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Unable to verify admin session", error);
    return NextResponse.json(
        { success: false, error: { code: "INTERNAL_ERROR", message: "Unable to verify admin session" } },
        { status: 500 },
      );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
