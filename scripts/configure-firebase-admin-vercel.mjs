import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectId = "eldawlystore-75acf";
const accountId = "vercel-payment-verifier";
const email = `${accountId}@${projectId}.iam.gserviceaccount.com`;
const firebaseConfig = JSON.parse(
  readFileSync(join(homedir(), ".config/configstore/firebase-tools.json"), "utf8"),
);
const accessToken = firebaseConfig.tokens?.access_token;

if (!accessToken || firebaseConfig.tokens.expires_at <= Date.now()) {
  throw new Error("Firebase CLI credentials are missing or expired. Run `firebase login`.");
}

async function googleRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || `Google API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

try {
  await googleRequest(
    `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts`,
    {
      method: "POST",
      body: JSON.stringify({
        accountId,
        serviceAccount: {
          displayName: "Vercel payment SMS verifier",
          description: "Server-side Firestore access for payment confirmation and SMS matching",
        },
      }),
    },
  );
  console.log("Created the dedicated Firebase service account.");
} catch (error) {
  if (error.status !== 409) throw error;
  console.log("Dedicated Firebase service account already exists.");
}

const policy = await googleRequest(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`,
  { method: "POST", body: "{}" },
);
const role = "roles/datastore.user";
const member = `serviceAccount:${email}`;
const binding = policy.bindings.find((item) => item.role === role);
if (binding) {
  if (!binding.members.includes(member)) binding.members.push(member);
} else {
  policy.bindings.push({ role, members: [member] });
}
await googleRequest(
  `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`,
  {
    method: "POST",
    body: JSON.stringify({
      policy: {
        bindings: policy.bindings,
        etag: policy.etag,
        version: policy.version,
      },
    }),
  },
);
console.log("Granted Firestore read/write access.");

const key = await googleRequest(
  `https://iam.googleapis.com/v1/projects/${projectId}/serviceAccounts/${encodeURIComponent(email)}/keys`,
  {
    method: "POST",
    body: JSON.stringify({
      privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
      keyAlgorithm: "KEY_ALG_RSA_2048",
    }),
  },
);
const credentials = JSON.parse(
  Buffer.from(key.privateKeyData, "base64").toString("utf8"),
);

for (const [name, value] of [
  ["FIREBASE_ADMIN_PROJECT_ID", credentials.project_id],
  ["FIREBASE_ADMIN_CLIENT_EMAIL", credentials.client_email],
  ["FIREBASE_ADMIN_PRIVATE_KEY", credentials.private_key],
]) {
  const result = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      name,
      "production,preview",
      "--sensitive",
      "--force",
      "--yes",
    ],
    { input: value, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    throw new Error(`Could not add ${name} to Vercel: ${result.stderr}`);
  }
  console.log(`Configured ${name} in Vercel.`);
}

console.log("Firebase Admin credentials are configured.");
