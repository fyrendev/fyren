import { z } from "zod";
import { baseEnvSchema } from "./base";

/**
 * Worker environment schema — extends base with worker-specific vars.
 * Used by the worker entry point (worker.ts) and notification workers.
 */
export const workerEnvSchema = baseEnvSchema.extend({
  APP_URL: z.string().default("http://localhost:3000"), // Needed by notification worker for email URLs
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function parseWorkerEnv(): WorkerEnv {
  const result = workerEnvSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const env = parseWorkerEnv();
