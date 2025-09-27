import axios from 'axios';
import { createPaymentPayload, encodePaymentPayload } from './payment';
import { getEnv } from './env';
import { db, schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export async function sendMessage(serviceUrl: string, skill: string, input: any, correlationId: string) {
  const { ADDRESS } = getEnv();
  
  const client = axios.create({ baseURL: serviceUrl, timeout: 40000 });
  const payload = { jsonrpc: '2.0', id: 1, method: 'message/send', params: { skill, input } };
  
  const { USER_PREFERRED_CHAIN } = getEnv();
  const userPreferredChain = USER_PREFERRED_CHAIN;
  console.log(`[CLIENT] User preferred chain: ${userPreferredChain}`);
  
  // First call without payment
  try {
    const initialHeaders = { 'X-CORRELATION-ID': correlationId, 'X-USER-CHAIN': userPreferredChain };
    const resp = await client.post('/a2a', payload, { headers: initialHeaders });
    if (resp.data && resp.data.error && resp.data.error.code === 402) {
      // Got payment required info from service agent
      const accepts = resp.data.error.data?.accepts || resp.data.error.data?.accepts;
      // For simplicity, pick first accepts and create a payment payload
      const first = Array.isArray(accepts) ? accepts[0] : accepts;
      console.log(`[CLIENT] First accepts: ${JSON.stringify(first)}`);

      if (!first?.maxAmountRequired) {
        throw new Error('Max amount required not found');
      }
      if (!first?.payTo) {
        throw new Error('PayTo address not found in accepts');
      }

      console.log(`[CLIENT] First max amount required: ${first?.maxAmountRequired}`);

      const value = first?.maxAmountRequired;
      
      // pay facilitator directly on user's preferred chain
      // facilitator will handle cross-chain bridging in background
      console.log(`[CLIENT] Payment analysis:`, {
        userPreferredChain,
        paymentAmount: value
      });
      
      // Get chainId and USDC contract address for user's preferred chain
      const chainIdMap: Record<string, number> = {
        'base': 8453,
        'base-sepolia': 84532,
        'polygon': 137,
        'polygon-amoy': 80002
      };
      const usdcAddressMap: Record<string, string> = {
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        'polygon': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        'polygon-amoy': '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'
      };
      
      const chainId = chainIdMap[userPreferredChain];
      const usdcAddress = usdcAddressMap[userPreferredChain];

      if (!chainId || !usdcAddress) {
        throw new Error(`Unsupported chain: ${userPreferredChain}`);
      }

      const payment = await createPaymentPayload(ADDRESS, first.payTo, value, usdcAddress, chainId);
      const b64 = encodePaymentPayload(payment);

      await db.update(schema.paymentLogs).set({
        paymentStatus: 'PAYMENT_PAYLOAD_CREATED',
        paymentPayload: b64,
        timestamp: new Date(),
      }).where(eq(schema.paymentLogs.correlationId, correlationId));
      
      // Prepare headers for retry
      const headers = { 'X-PAYMENT': b64, 'X-CORRELATION-ID': correlationId, 'X-USER-CHAIN': userPreferredChain };
      // Retry original call with payment
      const respWithPayment = await client.post('/a2a', payload, { headers });
      return respWithPayment.data;
    }
    return resp.data;
  }
  catch (e) {
    throw e;
  }
}
