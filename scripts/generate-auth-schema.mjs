import { getSchema } from "better-auth/dist/db/get-schema.mjs";
import { admin } from "better-auth/plugins/admin";

const config = {
  database: { provider: "sqlite", url: ":memory:" },
  emailAndPassword: { enabled: true, requireEmailVerification: true },
  socialProviders: {
    google: { clientId: "placeholder", clientSecret: "placeholder" },
  },
  plugins: [admin()],
};

const schema = getSchema(config);
const tables = Object.entries(schema).sort((a, b) => a[1].order - b[1].order);

console.log("-- Better Auth Schema (SQLite/D1)");
console.log("-- Generated:", new Date().toISOString() + "\n");

for (const [modelName, model] of tables) {
  if (model.disableMigrations) continue;
  const fieldMap = model.fields;
  const fieldLines = [];

  for (const [fieldName, field] of Object.entries(fieldMap)) {
    let line = "  " + fieldName;
    const ft = field.type;
    if (ft === "string") { line += field.required ? " TEXT NOT NULL" : " TEXT"; }
    else if (ft === "number") { line += field.required ? " INTEGER NOT NULL" : " INTEGER"; }
    else if (ft === "boolean") { line += " INTEGER NOT NULL DEFAULT " + (field.defaultValue ? 1 : 0); }
    else if (ft === "date") { line += field.required ? " TEXT NOT NULL" : " TEXT"; }
    else { line += " TEXT"; }

    if (field.defaultValue !== undefined && ft !== "boolean") {
      if (typeof field.defaultValue === "string" && !field.defaultValue.startsWith("$")) {
        line += " DEFAULT '" + field.defaultValue + "'";
      }
    }
    if (field.isPrimaryKey) line += " PRIMARY KEY";
    if (field.references) line += " REFERENCES " + field.references.model + "(" + field.references.field + ")";
    fieldLines.push(line);
  }

  console.log("-- Table: " + modelName);
  console.log("CREATE TABLE IF NOT EXISTS " + modelName + " (");
  console.log(fieldLines.join(",\n"));
  console.log(");\n");
}

// Indexes
console.log("-- Indexes");
for (const [modelName, model] of tables) {
  if (model.disableMigrations) continue;
  const fieldMap = model.fields;
  for (const [fieldName, field] of Object.entries(fieldMap)) {
    if (field.unique && !field.isPrimaryKey) {
      console.log("CREATE UNIQUE INDEX IF NOT EXISTS idx_" + modelName + "_" + fieldName + " ON " + modelName + "(" + fieldName + ");");
    }
    if (field.index && !field.unique && !field.isPrimaryKey) {
      console.log("CREATE INDEX IF NOT EXISTS idx_" + modelName + "_" + fieldName + " ON " + modelName + "(" + fieldName + ");");
    }
  }
}
