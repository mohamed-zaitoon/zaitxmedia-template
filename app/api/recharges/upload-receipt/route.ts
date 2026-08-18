import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ success: false, error: "لم يتم اختيار أي ملف" }, { status: 400 });
    }

    // 1. Validate MIME type
    const mimeType = file.type?.toLowerCase() || "";
    if (!mimeType || (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith("image/"))) {
      return NextResponse.json(
        { success: false, error: "نوع الملف غير مدعوم — يرجى اختيار صورة إيصال صحيحة (JPG, PNG, WEBP)" },
        { status: 400 },
      );
    }

    // 2. Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: "حجم الملف كبير جداً — الحد الأقصى المسموح هو 10 ميجابايت" },
        { status: 400 },
      );
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
        "content-type": mimeType || "application/octet-stream",
        "x-filename": file.name || `receipt_${Date.now()}.jpg`,
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Cloudflare Worker upload error:", errorText);
      return NextResponse.json(
        { success: false, error: "تعذر رفع صورة الإيصال إلى الخادم السحابي" },
        { status: response.status },
      );
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      url: result.url || result.fileUrl || result.link,
      data: result,
    });
  } catch (error) {
    console.error("Failed to upload receipt:", error);
    return NextResponse.json({ success: false, error: "حدث خطأ أثناء رفع صورة الإيصال" }, { status: 500 });
  }
}
