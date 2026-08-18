import { createHash, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "node:fs";

const scrypt = promisify(scryptCallback);

async function run() {
  let env = {};
  if (fs.existsSync(".env.local")) {
    const text = fs.readFileSync(".env.local", "utf8");
    env = Object.fromEntries(
      text
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, "")];
        })
    );
  }

  const email = env.ADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@zaitxmedia.com";
  const password = env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "FHUqs7zO2stsdDxZ35z9vJzfbnAsW3uV";
  const projectId = env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || "eldawlystore-75acf";
  const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  let app;
  if (getApps().length > 0) {
    app = getApps()[0];
  } else if (clientEmail && privateKey) {
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  } else {
    app = initializeApp({ projectId });
  }

  const db = getFirestore(app);
  const normalizedEmail = email.trim().toLowerCase();
  const docId = createHash("sha256").update(normalizedEmail).digest("hex");
  const accountRef = db.collection("admin_accounts").doc(docId);

  const salt = randomBytes(32).toString("base64");
  const derivedKey = await scrypt(password, salt, 64);
  const passwordHash = derivedKey.toString("base64");

  await accountRef.set({
    email: normalizedEmail,
    passwordHash,
    passwordSalt: salt,
    passwordAlgorithm: "scrypt-v1",
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log("✅ Admin account recreated successfully in Firestore:");
  console.log("   Email:", normalizedEmail);
  console.log("   DocId:", docId);
}

run().catch(console.error);
