import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  transform: {
    undefined: null, // Convert undefined values to null for SQL
  },
});

export const db = drizzle(client, { schema });

export async function closeConnection() {
  await client.end();
}

export async function runMigrations(migrationsPath?: string) {
  // Determine migrations folder:
  // 1. Explicit path from MIGRATIONS_PATH env var (Docker uses ./drizzle)
  // 2. In development: ../../packages/db/drizzle (relative to apps/api/)
  const folder = migrationsPath || "../../packages/db/drizzle";
  console.log(`🔄 Running migrations from ${folder}`);
  await migrate(db, { migrationsFolder: folder });
  console.log("✅ Migrations completed");
}

export * from "./schema";
export {
  sql,
  eq,
  and,
  or,
  desc,
  asc,
  like,
  ilike,
  isNull,
  isNotNull,
  inArray,
  gt,
  gte,
  lt,
  lte,
  count,
} from "drizzle-orm";
