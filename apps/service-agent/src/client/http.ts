import axios from 'axios';

// A minimal axios instance that will forward X-PAYMENT header if provided by caller
export function createResourceClient(baseURL: string) {
  const client = axios.create({ baseURL, timeout: 30_000 });
  return client;
}

export async function callPremiumSummarize(client: any, body: any, paymentHeader?: string, userChain?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (paymentHeader) headers['X-PAYMENT'] = paymentHeader;
  if (userChain) headers['X-USER-CHAIN'] = userChain;
  return client.post('/premium/summarize', body, { headers });
}
