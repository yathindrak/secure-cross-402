export const getEnv = () => {
  const env = {
    PORT: process.env.PORT,
    AMOY_RPC_URL: process.env.AMOY_RPC_URL,
    FACILITATOR_PRIVATE_KEY: process.env.FACILITATOR_PRIVATE_KEY || process.env.PRIVATE_KEY,
    AMOY_USDC_ADDRESS: process.env.AMOY_USDC_ADDRESS,
  };

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return env as { [key: string]: string };
};
