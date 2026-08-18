import { betterAuth } from "better-auth";

const auth = betterAuth({
  database: { provider: "sqlite", url: ":memory:" },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: { google: { clientId: "x", clientSecret: "x" } },
  secret: "test",
});

const keys = Object.keys(auth).filter(k => !k.startsWith("/"));
console.log("Auth keys:", keys.join(", "));
