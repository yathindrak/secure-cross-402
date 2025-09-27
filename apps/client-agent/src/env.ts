export const getEnv = () => {
  const env = {
    PRIVATE_KEY: process.env.PRIVATE_KEY,
    SERVICE_AGENT_URL: process.env.SERVICE_AGENT_URL,
    USER_PREFERRED_CHAIN: process.env.USER_PREFERRED_CHAIN,
    ADDRESS: process.env.ADDRESS,
  };

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  return env as { [key: string]: string };
};
