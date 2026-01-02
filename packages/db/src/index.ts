import { drizzle } from "drizzle-orm/postgres-js";
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
  gte,
  lte,
} from "drizzle-orm";
