import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This legacy webhook is disabled. Use the signed Worker webhook.",
      code: "LEGACY_WEBHOOK_DISABLED",
    },
    { status: 410 },
  );
}
