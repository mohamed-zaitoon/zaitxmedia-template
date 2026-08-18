import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb } from "@/app/lib/firebase-admin";

// GET: Fetch user preferences OR admin site defaults
export async function GET() {
  try {
    const { userId } = await auth();

    // 1. Fetch site defaults set by Admin in settings/site
    const siteSnap = await adminDb.collection("settings").doc("site").get();
    const siteData = siteSnap.exists ? siteSnap.data() : {};
    const defaultStyle = siteData?.defaultUiStyle || siteData?.default_ui_style || "glass";
    const defaultTheme = siteData?.defaultUiTheme || siteData?.default_ui_theme || "cyber";
    const defaultFloatingBar = siteData?.defaultFloatingBar !== false;

    if (!userId) {
      return NextResponse.json({
        success: true,
        preferences: {
          uiStyle: defaultStyle,
          uiTheme: defaultTheme,
          floatingBar: defaultFloatingBar,
          uiCustomizedByUser: false,
        },
      });
    }

    // 2. Fetch user profile from Firestore
    const profileSnap = await adminDb.collection("profiles").doc(userId).get();
    if (!profileSnap.exists) {
      return NextResponse.json({
        success: true,
        preferences: {
          uiStyle: defaultStyle,
          uiTheme: defaultTheme,
          floatingBar: defaultFloatingBar,
          uiCustomizedByUser: false,
        },
      });
    }

    const pData = profileSnap.data();
    const isCustomized = Boolean(pData?.uiCustomizedByUser || pData?.ui_customized_by_user);

    if (isCustomized) {
      return NextResponse.json({
        success: true,
        preferences: {
          uiStyle: pData?.uiStyle || pData?.ui_style || defaultStyle,
          uiTheme: pData?.uiTheme || pData?.ui_theme || defaultTheme,
          floatingBar: pData?.floatingBar !== undefined ? pData?.floatingBar : defaultFloatingBar,
          uiCustomizedByUser: true,
        },
      });
    }

    // If user hasn't customized their own theme, return Admin's site-wide default
    return NextResponse.json({
      success: true,
      preferences: {
        uiStyle: defaultStyle,
        uiTheme: defaultTheme,
        floatingBar: defaultFloatingBar,
        uiCustomizedByUser: false,
      },
    });
  } catch (error) {
    console.error("GET /api/user/preferences error:", error);
    return NextResponse.json({
      success: true,
      preferences: {
        uiStyle: "glass",
        uiTheme: "cyber",
        floatingBar: true,
        uiCustomizedByUser: false,
      },
    });
  }
}

// POST: Save user custom theme preferences
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json();
    const { uiStyle, uiTheme, floatingBar, uiCustomizedByUser } = body;

    const profileRef = adminDb.collection("profiles").doc(userId);
    await profileRef.set(
      {
        uiStyle: uiStyle || "glass",
        ui_style: uiStyle || "glass",
        uiTheme: uiTheme || "cyber",
        ui_theme: uiTheme || "cyber",
        floatingBar: floatingBar !== false,
        uiCustomizedByUser: uiCustomizedByUser !== false,
        ui_customized_by_user: uiCustomizedByUser !== false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/user/preferences error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

// DELETE: Reset user custom preference so they follow Admin site default
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const profileRef = adminDb.collection("profiles").doc(userId);
    await profileRef.set(
      {
        uiCustomizedByUser: false,
        ui_customized_by_user: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Fetch site defaults
    const siteSnap = await adminDb.collection("settings").doc("site").get();
    const siteData = siteSnap.exists ? siteSnap.data() : {};
    const defaultStyle = siteData?.defaultUiStyle || siteData?.default_ui_style || "glass";
    const defaultTheme = siteData?.defaultUiTheme || siteData?.default_ui_theme || "cyber";
    const defaultFloatingBar = siteData?.defaultFloatingBar !== false;

    return NextResponse.json({
      success: true,
      defaultPreferences: {
        uiStyle: defaultStyle,
        uiTheme: defaultTheme,
        floatingBar: defaultFloatingBar,
        uiCustomizedByUser: false,
      },
    });
  } catch (error) {
    console.error("DELETE /api/user/preferences error:", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
