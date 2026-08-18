// Better Auth server with Drizzle adapter
// Uses better-sqlite3 (Node.js) — for Workers, use drizzle-orm/d1

import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins/admin";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const user = sqliteTable("user", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified").notNull().default(0),
  name: text("name").notNull().default(""), image: text("image"),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

const session = sqliteTable("session", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), expiresAt: text("expiresAt").notNull(),
  ipAddress: text("ipAddress"), userAgent: text("userAgent"),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

const account = sqliteTable("account", {
  id: text("id").primaryKey(), userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  providerId: text("providerId").notNull(), accountId: text("accountId").notNull(),
  accessToken: text("accessToken"), refreshToken: text("refreshToken"), idToken: text("idToken"),
  accessTokenExpiresAt: text("accessTokenExpiresAt"), refreshTokenExpiresAt: text("refreshTokenExpiresAt"),
  scope: text("scope"), password: text("password"),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

const verification = sqliteTable("verification", {
  id: text("id").primaryKey(), identifier: text("identifier").notNull(),
  value: text("value").notNull(), expiresAt: text("expiresAt").notNull(),
  createdAt: text("createdAt").notNull(), updatedAt: text("updatedAt").notNull(),
});

export const schema = { user, session, account, verification };

let _db: any = null;

function getDb() {
  if (!_db) {
    const sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode=WAL");
    sqlite.pragma("foreign_keys=ON");
    
    // Create tables manually (drizzle doesn't auto-create)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS user (
        id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, emailVerified INTEGER DEFAULT 0,
        name TEXT DEFAULT '', image TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL, expiresAt TEXT NOT NULL,
        ipAddress TEXT, userAgent TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
        providerId TEXT NOT NULL, accountId TEXT NOT NULL,
        accessToken TEXT, refreshToken TEXT, idToken TEXT,
        accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT,
        scope TEXT, password TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider ON account(providerId, accountId);
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY, identifier TEXT NOT NULL,
        value TEXT NOT NULL, expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    
    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

export function createAuth(_d1Binding?: any) {
  const db = getDb();
  const isDev = process.env.NODE_ENV === "development";

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    basePath: "/v3",
    secret: process.env.BETTER_AUTH_SECRET || "local-dev-secret-change-me-for-testing",

    database: drizzleAdapter(db, { provider: "sqlite", schema }),

    emailAndPassword: { enabled: true, requireEmailVerification: false },
    socialProviders: undefined,

    trustedOrigins: [
      "http://localhost:3000", "http://127.0.0.1:3000",
      "https://zaitxmedia.com", "https://www.zaitxmedia.com",
      "https://auth.zaitxmedia.com",
    ].filter(Boolean),

    plugins: [],

    session: { cookieCache: { enabled: true, maxAge: 5 * 60 }, expiresIn: 7 * 24 * 60 * 60 },

    ...(isDev ? {} : {
      advanced: { crossSubDomainCookies: { enabled: true, domain: ".zaitxmedia.com" } },
    }),
  });
}

export type Auth = ReturnType<typeof createAuth>;
