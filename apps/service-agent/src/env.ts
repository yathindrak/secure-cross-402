import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(5402),
  RESOURCE_SERVER_URL: z.string().default('http://localhost:5403'),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  return envSchema.parse(process.env);
}
