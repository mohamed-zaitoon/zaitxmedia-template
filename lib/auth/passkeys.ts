import { randomBytes } from "node:crypto";
import { adminDb } from "@/app/lib/firebase-admin";

export interface StoredPasskey {
  userId: string;
  email?: string;
  passkeyId: string;
  rawId: string;
  type: string;
  publicKey?: string;
  counter?: number;
  transports?: string[];
  createdAt: any;
}

export function generateChallenge(): string {
  return randomBytes(32).toString("base64url");
}

export async function storeChallenge(userId: string, challenge: string): Promise<void> {
  await adminDb.collection("webauthn_challenges").doc(userId).set({
    challenge,
    createdAt: new Date(),
  });
}

export async function getChallenge(userId: string): Promise<string | null> {
  const ref = adminDb.collection("webauthn_challenges").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return snap.data()?.challenge || null;
}

export async function verifyAndRemoveChallenge(userId: string, challenge?: string): Promise<boolean> {
  const ref = adminDb.collection("webauthn_challenges").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const stored = snap.data()?.challenge;
  await ref.delete();
  if (!challenge) return true; // Just consumed
  return stored === challenge;
}

export async function storeUserPasskey(userId: string, passkeyData: {
  id: string;
  rawId: string;
  type: string;
  publicKey?: string;
  counter?: number;
  transports?: string[];
  email?: string;
}): Promise<void> {
  const docId = `${userId}_${passkeyData.id.replace(/[/\\?%*:|"<>]/g, "_")}`;
  await adminDb.collection("user_passkeys").doc(docId).set({
    userId,
    email: passkeyData.email || "",
    passkeyId: passkeyData.id,
    rawId: passkeyData.rawId || passkeyData.id,
    type: passkeyData.type || "public-key",
    publicKey: passkeyData.publicKey || "",
    counter: passkeyData.counter ?? 0,
    transports: passkeyData.transports || [],
    createdAt: new Date(),
  }, { merge: true });
}

export async function getUserPasskeys(userId: string, alternateId?: string): Promise<StoredPasskey[]> {
  if (!userId && !alternateId) return [];

  const idsToSearch = new Set<string>();
  if (userId) {
    idsToSearch.add(userId.trim());
    idsToSearch.add(userId.trim().toLowerCase());
  }
  if (alternateId) {
    idsToSearch.add(alternateId.trim());
    idsToSearch.add(alternateId.trim().toLowerCase());
  }

  const allPasskeys: StoredPasskey[] = [];

  try {
    for (const cleanId of Array.from(idsToSearch)) {
      if (!cleanId) continue;
      
      // Query by userId
      const snap1 = await adminDb
        .collection("user_passkeys")
        .where("userId", "==", cleanId)
        .get();
      snap1.docs.forEach((d) => allPasskeys.push(d.data() as StoredPasskey));

      // Query by email
      const snap2 = await adminDb
        .collection("user_passkeys")
        .where("email", "==", cleanId)
        .get();
      snap2.docs.forEach((d) => allPasskeys.push(d.data() as StoredPasskey));
    }

    // Fallback scan: if queries return empty, scan user_passkeys collection for docId or field prefix
    if (allPasskeys.length === 0) {
      const allDocsSnap = await adminDb.collection("user_passkeys").get();
      allDocsSnap.docs.forEach((d) => {
        const data = d.data() as StoredPasskey;
        const docIdLower = d.id.toLowerCase();
        const dataUserLower = (data.userId || "").toLowerCase();
        const dataEmailLower = (data.email || "").toLowerCase();

        for (const cleanId of Array.from(idsToSearch)) {
          const lower = cleanId.toLowerCase();
          if (
            docIdLower.startsWith(lower + "_") ||
            dataUserLower === lower ||
            dataEmailLower === lower
          ) {
            allPasskeys.push(data);
            break;
          }
        }
      });
    }
  } catch (err) {
    console.error("Error fetching passkeys in getUserPasskeys:", err);
  }

  // Deduplicate by passkeyId
  const uniqueMap = new Map<string, StoredPasskey>();
  for (const p of allPasskeys) {
    if (p && p.passkeyId && !uniqueMap.has(p.passkeyId)) {
      uniqueMap.set(p.passkeyId, p);
    }
  }

  return Array.from(uniqueMap.values());
}

export async function hasUserPasskey(userId: string, alternateId?: string): Promise<boolean> {
  if (!userId && !alternateId) return false;
  const passkeys = await getUserPasskeys(userId, alternateId);
  return passkeys.length > 0;
}

export function getRPConfig(req: Request) {
  const host = req.headers.get("host") || "localhost";
  const hostname = host.split(":")[0];
  const protocol = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  const requestOrigin = (req.headers.get("origin") || `${protocol}://${host}`).replace(/\/$/, "");

  // Domain ID for passkeys: if zaitxmedia.com domain, use root domain 'zaitxmedia.com'
  const rpID = hostname.endsWith("zaitxmedia.com") ? "zaitxmedia.com" : hostname;

  const validOrigins = Array.from(new Set([
    requestOrigin,
    `${protocol}://${host}`,
    `${protocol}://${hostname}`,
    "https://zaitxmedia.com",
    "https://www.zaitxmedia.com",
    "https://admin.zaitxmedia.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ]));

  return {
    rpID,
    origin: validOrigins,
    rpName: "ZAITX MEDIA",
  };
}

