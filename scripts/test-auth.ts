import { createAuth, schema } from "../lib/better-auth/server";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

async function test() {
  // Create DB and tables first
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  
  // Create tables via raw SQL
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, emailVerified INTEGER DEFAULT 0,
      name TEXT DEFAULT '', image TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id),
      token TEXT UNIQUE NOT NULL, expiresAt TEXT NOT NULL,
      ipAddress TEXT, userAgent TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES user(id),
      providerId TEXT NOT NULL, accountId TEXT NOT NULL,
      accessToken TEXT, refreshToken TEXT, idToken TEXT,
      accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT,
      scope TEXT, password TEXT, createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY, identifier TEXT NOT NULL,
      value TEXT NOT NULL, expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  console.log("Tables created");

  // Import and test
  const { createAuth } = await import("../lib/better-auth/server");
  const auth = createAuth();
  
  const req = new Request('http://localhost/v3/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@test.com', password: 'test123456', name: 'Test' })
  });
  const res = await auth.handler(req);
  console.log('Sign-up status:', res.status);
  const data = await res.json();
  console.log('Has user:', !!data?.user);
  
  const sessionReq = new Request('http://localhost/v3/get-session');
  const sessionRes = await auth.handler(sessionReq);
  console.log('Session status:', sessionRes.status);
}
test().catch(e => console.error(e.message));
