// Better Auth Route Handler
// Path: /v3/[...all]
// basePath: /v3
// Only active when deployed via OpenNext (not static export)

export const dynamic = "force-static";

import { createAuth } from "./server";

let _auth: ReturnType<typeof createAuth> | null = null;

function getAuth() {
  if (!_auth) _auth = createAuth();
  return _auth;
}

export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
