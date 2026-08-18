import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const database = process.env.D1_DATABASE_NAME || "zaitxmedia-db";
const config = process.env.WRANGLER_CONFIG || "wrangler.jsonc";
const apply = args.has("--apply");

if (args.has("--remote")) {
  throw new Error(
    "Remote execution is disabled in this stage. Obtain explicit approval first."
  );
}

function wrangler(extraArgs, options = {}) {
  return execFileSync(
    "npx",
    ["wrangler", "d1", ...extraArgs, "--local", "--config", config],
    { encoding: "utf8", stdio: options.capture ? "pipe" : "inherit" }
  );
}

const validationQuery = `
SELECT 'services.price_egp' AS field,
       COUNT(*) AS rows_count,
       SUM(price_egp) AS old_total,
       SUM(ROUND(price_egp * 100)) AS expected_minor_total
FROM services WHERE price_egp IS NOT NULL
UNION ALL
SELECT 'orders.price(EGP)', COUNT(*), SUM(price), SUM(ROUND(price * 100))
FROM orders WHERE currency = 'EGP'
UNION ALL
SELECT 'price_tiers.price_per_1000', COUNT(*), SUM(price_per_1000),
       SUM(ROUND(price_per_1000 * 100))
FROM price_tiers;
`;

const invalidQuery = `
SELECT 'services.price_egp' AS field, COUNT(*) AS invalid_rows
FROM services
WHERE price_egp IS NOT NULL
  AND (typeof(price_egp) NOT IN ('real', 'integer') OR price_egp < 0)
UNION ALL
SELECT 'orders.price', COUNT(*)
FROM orders
WHERE typeof(price) NOT IN ('real', 'integer') OR price < 0
UNION ALL
SELECT 'price_tiers.price_per_1000', COUNT(*)
FROM price_tiers
WHERE typeof(price_per_1000) NOT IN ('real', 'integer')
   OR price_per_1000 < 0;
`;

console.log(apply ? "Mode: LOCAL APPLY" : "Mode: LOCAL DRY-RUN");
wrangler(["execute", database, "--command", invalidQuery]);
wrangler(["execute", database, "--command", validationQuery]);

if (!apply) {
  console.log("Dry-run complete. No data was changed.");
  process.exit(0);
}

const backupDir = resolve("backups", "money-integer");
mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = resolve(backupDir, `${database}-${stamp}.sql`);
const backup = wrangler(["export", database], { capture: true });
writeFileSync(backupPath, backup, { mode: 0o600 });
console.log(`Local backup created: ${backupPath}`);

wrangler([
  "execute",
  database,
  "--file",
  "migrations/0007_money_integer_prepare.sql",
]);

wrangler(["execute", database, "--command", validationQuery]);
console.log(
  "Local additive migration complete. Legacy REAL columns were retained for rollback."
);
