import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(5403),
  RESOURCE_SERVER_ADDRESS: z.string(),
  FACILITATOR_URL: z.string().default('http://localhost:5401'),
  FACILITATOR_ADDRESS: z.string(),
  TARGET_CHAIN: z.string().default('polygon-amoy'),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}
