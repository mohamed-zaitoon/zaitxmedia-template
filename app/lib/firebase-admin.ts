import "server-only";

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "eldawlystore-75acf";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  let credential;
  if (clientEmail && privateKey && privateKey.includes("BEGIN PRIVATE KEY")) {
    try {
      credential = cert({ projectId, clientEmail, privateKey });
    } catch {
      credential = applicationDefault();
    }
  } else {
    credential = applicationDefault();
  }

  return initializeApp({
    credential,
    projectId,
  });
}

export const adminDb = getFirestore(getAdminApp());
