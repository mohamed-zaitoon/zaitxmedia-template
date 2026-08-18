import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "../../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/auth/admin";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    let apiKey = process.env.BINANCE_READONLY_API_KEY;
    let apiSecret = process.env.BINANCE_READONLY_API_SECRET;

    // Fallback to Firestore if environment variables are not set
    if (!apiKey || !apiSecret) {
      const reserveSnap = await getDoc(doc(db, "settings", "reserve"));
      if (reserveSnap.exists()) {
        const data = reserveSnap.data();
        apiKey = apiKey || data.binanceApiKey;
        apiSecret = apiSecret || data.binanceApiSecret;
      }
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Binance API keys not configured in environment variables or settings." }, { status: 400 });
    }

    // 3. Binance API Request
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
    // Create HMAC SHA256 signature
    const signature = crypto
      .createHmac("sha256", apiSecret)
      .update(queryString)
      .digest("hex");

    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Binance API Error:", errorText);
      return NextResponse.json({ error: "Failed to fetch from Binance API" }, { status: response.status });
    }

    const data = await response.json();
    
    // Find USDT balance
    const usdtAsset = data.balances?.find((b: any) => b.asset === "USDT");
    
    if (!usdtAsset) {
      return NextResponse.json({ balance: "0.00000000" });
    }

    const free = Number(usdtAsset.free);
    const locked = Number(usdtAsset.locked);
    const total = free + locked;

    return NextResponse.json({ 
      balance: total.toFixed(8),
      free: free.toFixed(8),
      locked: locked.toFixed(8)
    });

  } catch (error: any) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Binance Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
