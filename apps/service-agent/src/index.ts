import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { getEnv } from './env';
import { createResourceClient, callPremiumSummarize } from './client/http.js';
import { db, schema } from '@repo/database';
import { eq } from 'drizzle-orm';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { PORT, RESOURCE_SERVER_URL } = getEnv();

const resourceClient = createResourceClient(RESOURCE_SERVER_URL);

app.post('/a2a', async (req: any, res: any) => {
  // Minimal JSON-RPC 2.0 handler for message/send
  const { jsonrpc, method, params, id } = req.body || {};
  if (jsonrpc !== '2.0') return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } });

  const correlationId = req.headers['x-correlation-id'] as string;
  if (!correlationId) {
    return res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'x-correlation-id header is required' } });
  }

  if (method === 'message/send') {
    const payload = params || {};
    const skill = payload.skill;
    if (skill === 'premium.summarize') {
      // Call resource server. The client is responsible for producing X-PAYMENT; here we forward if provided.
      const body = payload.input || {};
      const clientPaymentHeader = req.headers['x-payment'] as string | undefined;
      try {
        // If the client provided X-PAYMENT header to the service agent, forward it. Otherwise, service agent will call resource server without payment and receive 402.
        const userChain = req.headers['x-user-chain'] as string | undefined;
        console.log(`[SERVICE] User chain: ${userChain}`);
        console.log(`[SERVICE] Client payment header: ${clientPaymentHeader}`);
        const resp = await callPremiumSummarize(resourceClient, body, clientPaymentHeader, userChain, correlationId);
        const result = resp.data;
        // If resource included X-PAYMENT-RESPONSE header, include it in result meta
        const xpr = resp.headers['x-payment-response'] as string | undefined;


        await db.update(schema.paymentLogs).set({
          serviceAgentUrl: `http://localhost:${PORT}`,
          paymentStatus: 'REQUEST_PROCESSED',
          timestamp: new Date(),
          paymentPayload: clientPaymentHeader,
        }).where(eq(schema.paymentLogs.correlationId, correlationId));

        return res.json({ jsonrpc: '2.0', id, result: { downstream: result, xPaymentResponse: xpr || null } });
      } catch (e: any) {
        // If resource server returned 402 with accepts, propagate that in error
        if (e.response && e.response.status === 402) {


          await db.update(schema.paymentLogs).set({
            serviceAgentUrl: `http://localhost:${PORT}`,
            paymentStatus: 'PAYMENT_REQUIRED_FROM_RESOURCE',
            timestamp: new Date(),
            paymentPayload: clientPaymentHeader,
          }).where(eq(schema.paymentLogs.correlationId, correlationId));

          return res.json({ jsonrpc: '2.0', id, error: { code: 402, message: 'Payment Required', data: e.response.data } });
        }


        await db.update(schema.paymentLogs).set({
          serviceAgentUrl: `http://localhost:${PORT}`,
          paymentStatus: 'ERROR_FROM_RESOURCE',
          riskRationale: String(e),
          timestamp: new Date(),
          paymentPayload: clientPaymentHeader,
        }).where(eq(schema.paymentLogs.correlationId, correlationId));

        return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: 'Server error', data: String(e) } });
      }
    }

    // Default echo handler
    return res.json({ jsonrpc: '2.0', id, result: { echo: params } });
  }

  return res.status(404).json({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
});

app.get('/healthz', (_req: any, res: any) => res.json({ ok: true, resource: RESOURCE_SERVER_URL }));

app.listen(PORT, () => console.log(`[SERVICE-AGENT] listening on ${PORT}, resource=${RESOURCE_SERVER_URL}`));
