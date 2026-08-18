import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firebase-admin";

import { ALLOWED_ADMIN_EMAILS } from "@/lib/auth/admin";

const NAME_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;     // 7 Days
const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

const EDITABLE_PROFILE_FIELDS = new Set([
  "name",
  "full_name",
  "username",
  "whatsapp",
  "country",
  "country_code",
  "preferred_currency",
  "preferred_payment_methods",
  "payment_methods_configured",
  "imageUrl",
  "avatar_url",
]);

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "";
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const clerkUser = await currentUser();
  const userEmail = (clerkUser?.primaryEmailAddress?.emailAddress || "").trim().toLowerCase();
  const isAdminEmail = ALLOWED_ADMIN_EMAILS.includes(userEmail);

  const profileRef = adminDb.collection("profiles").doc(userId);
  let profile = await profileRef.get();
  if (!profile.exists) {
    await profileRef.set({
      id: userId,
      email: userEmail,
      name: clerkUser?.fullName || "",
      username: "",
      imageUrl: clerkUser?.imageUrl || "",
      country_code: "",
      whatsapp: "",
      role: isAdminEmail ? "admin" : "user",
      last_ip: clientIp,
      last_seen_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    profile = await profileRef.get();
  } else {
    const patch: Record<string, unknown> = {};
    if (isAdminEmail && profile.data()?.role !== "admin") patch.role = "admin";
    if (clientIp && profile.data()?.last_ip !== clientIp) patch.last_ip = clientIp;
    patch.last_seen_at = new Date().toISOString();
    if (Object.keys(patch).length > 0) {
      await profileRef.set(patch, { merge: true });
      profile = await profileRef.get();
    }
  }

  const data = profile.data() || {};
  const now = Date.now();

  // Calculate cooldowns for UI status
  let nameCooldownRemainingDays = 0;
  if (data.name_updated_at) {
    const elapsed = now - new Date(data.name_updated_at).getTime();
    if (elapsed < NAME_COOLDOWN_MS) {
      nameCooldownRemainingDays = Math.ceil((NAME_COOLDOWN_MS - elapsed) / (1000 * 60 * 60 * 24));
    }
  }

  let usernameCooldownRemainingDays = 0;
  if (data.username_updated_at) {
    const elapsed = now - new Date(data.username_updated_at).getTime();
    if (elapsed < USERNAME_COOLDOWN_MS) {
      usernameCooldownRemainingDays = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / (1000 * 60 * 60 * 24));
    }
  }

  return NextResponse.json({
    success: true,
    profile: {
      id: profile.id,
      email: data.email || userEmail,
      name: data.name || "",
      username: data.username || "",
      whatsapp: data.whatsapp || "",
      country_code: data.country_code || "",
      country: data.country || "",
      imageUrl: data.imageUrl || clerkUser?.imageUrl || "",
      avatar_url: data.avatar_url || data.imageUrl || clerkUser?.imageUrl || "",
      role: data.role || "user",
      balance: data.balance || 0,
      balances: data.balances || { USD: data.balance || 0 },
      uiStyle: data.uiStyle || "cyber_glass",
      uiTheme: data.uiTheme || "glass_dark",
      floatingBar: data.floatingBar ?? true,
      uiCustomizedByUser: Boolean(data.uiCustomizedByUser),
      last_ip: data.last_ip || clientIp || "",
      banned: Boolean(data.banned),
      ban_reason: data.ban_reason || "",
      banned_ip: data.banned_ip || "",
      canChangeName: nameCooldownRemainingDays === 0,
      nameCooldownDays: nameCooldownRemainingDays,
      canChangeUsername: usernameCooldownRemainingDays === 0,
      usernameCooldownDays: usernameCooldownRemainingDays,
    },
  });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(request);
  const body = await request.json().catch(() => ({}));
  const profileRef = adminDb.collection("profiles").doc(userId);
  const profileSnap = await profileRef.get();
  if (!profileSnap.exists) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const existingData = profileSnap.data() || {};
  const updates: Record<string, unknown> = {};
  const now = Date.now();
  const isoNow = new Date().toISOString();

  // Validate Name edit cooldown
  if (body.name !== undefined && typeof body.name === "string") {
    const newName = body.name.trim();
    if (newName !== existingData.name) {
      if (existingData.name_updated_at) {
        const elapsed = now - new Date(existingData.name_updated_at).getTime();
        if (elapsed < NAME_COOLDOWN_MS) {
          const daysLeft = Math.ceil((NAME_COOLDOWN_MS - elapsed) / (1000 * 60 * 60 * 24));
          return NextResponse.json(
            { error: `يمكنك تغيير الاسم مرة واحدة كل 7 أيام. متبقي ${daysLeft} أيام.` },
            { status: 429 },
          );
        }
      }
      updates.name = newName;
      updates.name_updated_at = isoNow;
    }
  }

  // Validate Username edit cooldown and uniqueness
  if (body.username !== undefined && typeof body.username === "string") {
    const rawUsername = body.username.trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
    if (rawUsername && rawUsername !== (existingData.username || "").toLowerCase()) {
      if (rawUsername.length < 3 || rawUsername.length > 30) {
        return NextResponse.json({ error: "اسم المستخدم يجب أن يكون بين 3 و 30 حرفاً." }, { status: 400 });
      }
      if (existingData.username_updated_at) {
        const elapsed = now - new Date(existingData.username_updated_at).getTime();
        if (elapsed < USERNAME_COOLDOWN_MS) {
          const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / (1000 * 60 * 60 * 24));
          return NextResponse.json(
            { error: `يمكنك تغيير اسم المستخدم مرة واحدة كل 30 يوماً. متبقي ${daysLeft} أيام.` },
            { status: 429 },
          );
        }
      }

      const existingUser = await adminDb.collection("profiles").where("username", "==", rawUsername).limit(1).get();
      if (!existingUser.empty && existingUser.docs[0].id !== userId) {
        return NextResponse.json({ error: "اسم المستخدم هذا مأخوذ بالفعل، اختر اسماً آخر." }, { status: 409 });
      }

      updates.username = rawUsername;
      updates.username_updated_at = isoNow;
    }
  }

  for (const key of Object.keys(body)) {
    if (EDITABLE_PROFILE_FIELDS.has(key) && key !== "name" && key !== "username") {
      updates[key] = body[key];
    }
  }

  if (clientIp) {
    updates.last_ip = clientIp;
    updates.last_seen_at = isoNow;
  }

  if (Object.keys(updates).length > 0) {
    updates.updatedAt = isoNow;
    await profileRef.set(updates, { merge: true });
  }

  const updatedSnap = await profileRef.get();
  return NextResponse.json({
    success: true,
    profile: {
      id: updatedSnap.id,
      ...updatedSnap.data(),
    },
  });
}

export const PUT = PATCH;
