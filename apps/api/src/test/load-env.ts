import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dir, "../../.env.test");
const envFile = readFileSync(envPath, "utf-8");

for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  const value = trimmed.slice(eqIndex + 1);
  Bun.env[key] = value;
}

// Safety check: abort if DATABASE_URL doesn't point at the test database
if (!Bun.env.DATABASE_URL?.includes("fyren_test")) {
  console.error(
    `\x1b[31mERROR: DATABASE_URL does not point at fyren_test — aborting to protect dev data.\x1b[0m\n` +
      `DATABASE_URL: ${Bun.env.DATABASE_URL}`
  );
  process.exit(1);
}
