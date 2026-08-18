import { NextResponse } from "next/server";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function POST(request: Request) {
  try {
    // 1. Verify admin
    await requireAdmin();

    // 2. Read file from request Form Data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    // 3. Convert file to ArrayBuffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // 4. Send to Cloudflare Worker API
    const workerUrl = "https://api.zaitxmedia.com/api/internal/upload";
    const internalSecret = process.env.INTERNAL_API_SECRET || "dev_secret_fallback";

    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "x-internal-secret": internalSecret,
        "content-type": file.type || "application/octet-stream",
        "x-filename": file.name,
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ success: false, error: `Worker error: ${errorText}` }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Failed to upload image via Next.js backend:", error);
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}
