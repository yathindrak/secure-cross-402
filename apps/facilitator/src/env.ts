export const getEnv = () => {
  const env = {
    PORT: process.env.PORT,
    FACILITATOR_PRIVATE_KEY: process.env.FACILITATOR_PRIVATE_KEY || process.env.PRIVATE_KEY,
  };

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return env as { [key: string]: string };
};
