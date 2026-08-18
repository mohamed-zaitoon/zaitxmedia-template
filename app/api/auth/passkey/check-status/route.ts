import { NextRequest, NextResponse } from "next/server";
import { hasUserPasskey, getUserPasskeys } from "@/lib/auth/passkeys";

export async function POST(req: NextRequest) {
  try {
    const { userId, email, emails } = await req.json();
    if (!userId && !email && (!emails || emails.length === 0)) {
      return NextResponse.json({ hasPasskey: false });
    }

    const identifiers = new Set<string>();
    if (userId) identifiers.add(userId);
    if (email) identifiers.add(email);
    if (Array.isArray(emails)) {
      emails.forEach((e: string) => e && identifiers.add(e));
    }

    let allPasskeys: any[] = [];
    for (const id of Array.from(identifiers)) {
      const found = await getUserPasskeys(id);
      if (found && found.length > 0) {
        allPasskeys = allPasskeys.concat(found);
      }
    }

    // Deduplicate
    const uniquePasskeys = Array.from(new Set(allPasskeys.map(p => p.passkeyId)))
      .map(id => allPasskeys.find(p => p.passkeyId === id));

    const hasPasskey = uniquePasskeys.length > 0;

    return NextResponse.json({
      hasPasskey,
      count: uniquePasskeys.length,
      matchingUserId: uniquePasskeys[0]?.userId || userId || email,
    });
  } catch (err: any) {
    return NextResponse.json({ hasPasskey: false });
  }
}
