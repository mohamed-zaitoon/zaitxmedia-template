import "server-only";

import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { FieldValue } from "firebase-admin/firestore";
import { cookies } from "next/headers";
import { adminDb } from "@/app/lib/firebase-admin";

export const ADMIN_SESSION_COOKIE = "zaitxmedia_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const ADMIN_ACCOUNTS_COLLECTION = "admin_accounts";
const PASSWORD_KEY_LENGTH = 64;
const scrypt = promisify(scryptCallback);

export interface VerifiedAdmin {
  userId: string;
  email: string;
}

interface AdminSessionPayload extends VerifiedAdmin {
  expiresAt: number;
  nonce: string;
}

interface AdminPushEnrollmentPayload {
  purpose: "admin-push-enrollment";
  expiresAt: number;
  nonce: string;
}

export class AdminAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AdminAuthorizationError";
    this.status = status;
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return secret;
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Buffer.from(signature).toString("base64url");
}

async function signaturesMatch(left: string, right: string): Promise<boolean> {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a[index] ^ b[index];
  }
  return mismatch === 0;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function adminDocumentId(email: string): string {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return derivedKey.toString("base64");
}

async function passwordMatches(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actual = Buffer.from(await hashPassword(password, salt), "base64");
  const expected = Buffer.from(expectedHash, "base64");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const ALLOWED_ADMIN_EMAILS = [
  "admin@example.com",
  "demo@example.com",
];

async function createBootstrapAdminIfNeeded(
  email: string,
  password: string,
): Promise<void> {
  const bootstrapEmail = normalizeEmail(process.env.ADMIN_EMAIL || "");
  const bootstrapPassword = process.env.ADMIN_PASSWORD || "";
  const isAllowedAdminEmail =
    ALLOWED_ADMIN_EMAILS.includes(email) ||
    (bootstrapEmail && email === bootstrapEmail);

  if (
    !isAllowedAdminEmail ||
    bootstrapPassword.length < 8 ||
    password !== bootstrapPassword
  ) {
    return;
  }

  const accountRef = adminDb
    .collection(ADMIN_ACCOUNTS_COLLECTION)
    .doc(adminDocumentId(email));
  const salt = randomBytes(32).toString("base64");
  await accountRef.create({
    email,
    passwordHash: await hashPassword(password, salt),
    passwordSalt: salt,
    passwordAlgorithm: "scrypt-v1",
    active: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }).catch((error: unknown) => {
    // Another concurrent request may have created the bootstrap account.
    if (
      typeof error !== "object" ||
      error === null ||
      !("code" in error) ||
      ((error as { code?: number | string }).code !== 6 &&
        (error as { code?: number | string }).code !== "6" &&
        (error as { code?: number | string }).code !== "already-exists")
    ) {
      throw error;
    }
  });
}

export async function authenticateAdmin(
  suppliedEmail: string,
  suppliedPassword: string,
): Promise<VerifiedAdmin> {
  const email = normalizeEmail(suppliedEmail);
  if (!email || !suppliedPassword) {
    throw new AdminAuthorizationError(401, "Invalid admin credentials");
  }

  const accountRef = adminDb
    .collection(ADMIN_ACCOUNTS_COLLECTION)
    .doc(adminDocumentId(email));
  let account = await accountRef.get();
  if (!account.exists) {
    await createBootstrapAdminIfNeeded(email, suppliedPassword);
    account = await accountRef.get();
  }

  const data = account.data();
  const validAccount =
    account.exists
    && data?.active === true
    && data?.email === email
    && data?.passwordAlgorithm === "scrypt-v1"
    && typeof data?.passwordSalt === "string"
    && typeof data?.passwordHash === "string";
  const validPassword = validAccount
    ? await passwordMatches(
      suppliedPassword,
      data.passwordSalt,
      data.passwordHash,
    )
    : false;

  if (!validAccount || !validPassword) {
    throw new AdminAuthorizationError(401, "Invalid admin credentials");
  }

  await accountRef.update({
    lastLoginAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { userId: account.id, email };
}

export async function createAdminSessionToken(
  admin: VerifiedAdmin,
): Promise<string> {
  const payload: AdminSessionPayload = {
    ...admin,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function createAdminPushEnrollmentToken(): Promise<string> {
  const payload: AdminPushEnrollmentPayload = {
    purpose: "admin-push-enrollment",
    expiresAt: Date.now() + 5 * 60 * 1000,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${await sign(encodedPayload)}`;
}

export async function verifyAdminPushEnrollmentToken(
  token: string,
): Promise<boolean> {
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return false;
  const expectedSignature = await sign(encodedPayload);
  if (!(await signaturesMatch(suppliedSignature, expectedSignature))) return false;
  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as AdminPushEnrollmentPayload;
    return payload.purpose === "admin-push-enrollment"
      && Number.isFinite(payload.expiresAt)
      && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}

async function readAdminSession(): Promise<AdminSessionPayload | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  const [encodedPayload, suppliedSignature] = token.split(".");
  if (!encodedPayload || !suppliedSignature) return null;
  const expectedSignature = await sign(encodedPayload);
  if (!(await signaturesMatch(suppliedSignature, expectedSignature))) return null;

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload),
    ) as AdminSessionPayload;
    if (
      !payload.userId
      || !Number.isFinite(payload.expiresAt)
      || payload.expiresAt <= Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<VerifiedAdmin> {
  const session = await readAdminSession();
  if (!session) {
    throw new AdminAuthorizationError(401, "Admin session required");
  }

  const account = await adminDb
    .collection(ADMIN_ACCOUNTS_COLLECTION)
    .doc(session.userId)
    .get();
  if (
    !account.exists
    || account.data()?.active !== true
    || account.data()?.email !== session.email
  ) {
    throw new AdminAuthorizationError(403, "Admin access required");
  }

  return { userId: session.userId, email: session.email };
}

export function adminAuthErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AdminAuthorizationError)) return null;
  return Response.json(
    {
      success: false,
      error: {
        code: error.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
        message: error.message,
      },
    },
    { status: error.status },
  );
}
