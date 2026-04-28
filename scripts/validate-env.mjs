import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dotenvPath = path.join(root, ".env");

const parseDotEnv = (text) => {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

const fileEnv = fs.existsSync(dotenvPath)
  ? parseDotEnv(fs.readFileSync(dotenvPath, "utf8"))
  : {};

const env = { ...fileEnv, ...process.env };
const stripQuotes = (value) => {
  if (!value) return value;
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
};

const required = ["VITE_SUPABASE_URL"];
const optionalAlternatives = ["VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"];

const missing = required.filter((name) => !stripQuotes(env[name])?.trim());
const frontendKey = optionalAlternatives
  .map((name) => stripQuotes(env[name])?.trim())
  .find(Boolean);

const errors = [];

for (const name of missing) {
  errors.push(`Missing required environment variable: ${name}`);
}

if (!frontendKey) {
  errors.push(
    `Missing Supabase frontend key: set one of ${optionalAlternatives.join(" or ")}`,
  );
}

const url = stripQuotes(env.VITE_SUPABASE_URL)?.trim();
if (url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".supabase.co")) {
      errors.push(
        "VITE_SUPABASE_URL looks invalid. Expected a Supabase URL like https://<project-ref>.supabase.co",
      );
    }
  } catch {
    errors.push(
      "VITE_SUPABASE_URL is not a valid URL. Expected https://<project-ref>.supabase.co",
    );
  }
}

if (url && frontendKey) {
  try {
    const urlRef = new URL(url).hostname.split(".")[0];
    const payload = JSON.parse(
      Buffer.from(frontendKey.split(".")[1] || "", "base64url").toString("utf8"),
    );
    const keyRef = String(payload.ref || "");
    if (!keyRef) {
      errors.push(
        "Supabase frontend key format looks invalid (missing JWT ref payload).",
      );
    } else if (urlRef !== keyRef) {
      errors.push(
        `Supabase URL/key mismatch: URL project ref is "${urlRef}" but key project ref is "${keyRef}". Use key from the same Supabase project as VITE_SUPABASE_URL.`,
      );
    }
  } catch {
    errors.push(
      "Could not decode Supabase frontend key. Ensure VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY is a valid anon/publishable JWT.",
    );
  }
}

if (frontendKey && frontendKey.startsWith("sb_secret_")) {
  errors.push(
    "Detected a Supabase secret key in frontend env. Use anon/publishable key only (never sb_secret_*).",
  );
}

if (errors.length > 0) {
  console.error("Environment validation failed:\n");
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  console.error(
    "\nFix local .env and deployment env vars (for example in Vercel Project Settings -> Environment Variables), then rebuild.",
  );
  process.exit(1);
}

console.log("Environment validation passed.");
