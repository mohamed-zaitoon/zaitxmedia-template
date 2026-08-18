// Better Auth client - for future use with OpenNext deployment
// Connects to: https://auth.zaitxmedia.com/v3

import { createAuthClient } from "better-auth/client";

const baseURL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: `${baseURL}/v3`,
});
