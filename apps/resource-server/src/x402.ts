import axios from 'axios';
import { getEnv } from './env';
import { PaymentRequirements } from './types.js';

const { FACILITATOR_URL } = getEnv();

export function buildPaymentRequirements(resourceUrl: string, payTo: string, asset: string, targetChain: string = 'polygon-amoy'): PaymentRequirements {
  return {
    scheme: 'exact',
    network: targetChain,
    resource: resourceUrl,
    description: 'Premium summarization',
    mimeType: 'application/json',
    payTo,
    maxAmountRequired: '100000',
    maxTimeoutSeconds: 120,
    asset,
    extra: { name: 'USDC', version: '2' },
    outputSchema: { input: { type: 'http', method: 'POST' }, output: {} }
  };
}

export async function verifyPayment(paymentPayloadBase64: string) {
  const url = `${FACILITATOR_URL}/verify`;
  try {
    const resp = await axios.post(url, { paymentPayloadBase64 }, { timeout: 10_000 });
    return resp.data;
  } catch (err: any) {
    if (err.response) return err.response.data;
    throw err;
  }
}

export async function settlePayment(paymentPayloadBase64: string, userChain?: string, targetChain?: string, resourceServerAddress?: string) {
  const url = `${FACILITATOR_URL}/settle`;
  const headers: Record<string, string> = {};
  if (userChain) {
    headers['X-USER-CHAIN'] = userChain;
  }
  if (targetChain) {
    headers['X-TARGET-CHAIN'] = targetChain;
  }
  if (resourceServerAddress) {
    headers['X-RESOURCE-SERVER-ADDRESS'] = resourceServerAddress;
  }
  
  try {
    const resp = await axios.post(url, { paymentPayloadBase64 }, { 
      timeout: 30_000,
      headers
    });
    return { data: resp.data, headers: resp.headers };
  } catch (err: any) {
    if (err.response) return { data: err.response.data, headers: err.response.headers };
    throw err;
  }
}
