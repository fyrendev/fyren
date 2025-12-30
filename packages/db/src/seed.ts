import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 32;
const PREFIX = "fyr_";

function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => CHARSET[byte % CHARSET.length])
    .join("");
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateApiKey(): Promise<{
  key: string;
  keyHash: string;
  keyPrefix: string;
}> {
  const randomPart = generateRandomString(KEY_LENGTH);
  const key = `${PREFIX}${randomPart}`;
  const keyHash = await hashApiKey(key);
  const keyPrefix = key.slice(0, 12);

  return { key, keyHash, keyPrefix };
}

async function seed() {
  const connectionString = process.env.DATABASE_URL!;
  if (!connectionString) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client, { schema });

  console.log("🌱 Seeding database...\n");

  // Create demo organization
  const [org] = await db
    .insert(schema.organizations)
    .values({
      name: "Acme Corp",
      slug: "acme",
      timezone: "UTC",
    })
    .returning();

  console.log(`✅ Created organization: ${org.name} (${org.slug})`);

  // Create sample components
  const componentData = [
    { name: "API", status: "operational" as const, displayOrder: 1 },
    { name: "Dashboard", status: "operational" as const, displayOrder: 2 },
    { name: "Database", status: "operational" as const, displayOrder: 3 },
    { name: "Background Jobs", status: "degraded" as const, displayOrder: 4 },
  ];

  const createdComponents = await db
    .insert(schema.components)
    .values(
      componentData.map((c) => ({
        organizationId: org.id,
        name: c.name,
        status: c.status,
        displayOrder: c.displayOrder,
        isPublic: true,
      }))
    )
    .returning();

  console.log(`✅ Created ${createdComponents.length} components:`);
  for (const comp of createdComponents) {
    console.log(`   - ${comp.name} (${comp.status})`);
  }

  // Create API key
  const apiKeyData = await generateApiKey();
  const [apiKey] = await db
    .insert(schema.apiKeys)
    .values({
      organizationId: org.id,
      name: "Default API Key",
      keyHash: apiKeyData.keyHash,
      keyPrefix: apiKeyData.keyPrefix,
    })
    .returning();

  console.log(`\n✅ Created API key: ${apiKey.name}`);
  console.log(`\n🔑 API Key (save this - it won't be shown again):`);
  console.log(`   ${apiKeyData.key}\n`);

  await client.end();
  console.log("✨ Seed completed!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
