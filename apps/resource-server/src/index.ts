import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { getEnv } from './env';
import { buildPaymentRequirements, verifyPayment, settlePayment } from './x402';
import { summarize } from './premium/summarize';
import { getUsdcAddressForChain } from './utils/helpers';
import { db, schema } from '@repo/database';
import { eq } from 'drizzle-orm';

const app = express();
app.use(cors({ exposedHeaders: ['X-PAYMENT-RESPONSE'] }));
app.use(bodyParser.json());

const { PORT, RESOURCE_SERVER_ADDRESS: ADDRESS, FACILITATOR_URL, FACILITATOR_ADDRESS, TARGET_CHAIN } = getEnv();

const explorerUrlMap: Record<string, string> = {
  'polygon-amoy': 'https://amoy.polygonscan.com/tx/',
  'base-sepolia': 'https://sepolia.basescan.org/tx/',
  'polygon': 'https://polygonscan.com/tx/',
  'base': 'https://basescan.org/tx/',
};

app.post('/premium/summarize', async (req: any, res: any) => {
  const paymentHeader = req.headers['x-payment'] as string | undefined;
  const userChain = req.headers['x-user-chain'] as string | undefined;
  
  const correlationId = req.headers['x-correlation-id'] as string;
  if (!correlationId) {
    return res.status(400).json({ error: 'x-correlation-id header is required' });
  }

  console.log(`[RESOURCE] Request received:`, {
    hasPayment: !!paymentHeader,
    userChain,
    targetChain: TARGET_CHAIN,
    isCrossChain: userChain && userChain !== TARGET_CHAIN,
  });
  
  const resourceUrl = `http://localhost:${PORT}/premium/summarize`;
  const existingLog = await db.query.paymentLogs.findFirst({
    where: eq(schema.paymentLogs.correlationId, correlationId),
  });

  // If no payment header, return 402 with accepts
  if (!paymentHeader) {
    const accepts = [buildPaymentRequirements(resourceUrl, FACILITATOR_ADDRESS, getUsdcAddressForChain(TARGET_CHAIN), TARGET_CHAIN)];
    
    if (existingLog) {
      await db.update(schema.paymentLogs).set({
        paymentStatus: 'CHALLENGED',
        timestamp: new Date(),
        userChain: userChain,
        serverChain: TARGET_CHAIN,
      }).where(eq(schema.paymentLogs.correlationId, correlationId));
    } else {
      await db.insert(schema.paymentLogs).values({
        correlationId,
        resourceServerUrl: resourceUrl,
        paymentStatus: 'CHALLENGED',
        timestamp: new Date(),
        userChain: userChain,
        serverChain: TARGET_CHAIN,
      });
    }

    return res.status(402).json({ accepts });
  }

  // Verify via facilitator
  try {
    const verify = await verifyPayment(paymentHeader, correlationId);
    if (!verify || !verify.success) {


      await db.update(schema.paymentLogs).set({
        paymentStatus: 'VERIFICATION_FAILED',
        riskLevel: verify?.riskProfile?.level,
        riskRationale: verify?.reason,
        timestamp: new Date(),
        paymentPayload: paymentHeader,
      }).where(eq(schema.paymentLogs.correlationId, correlationId));

      return res.status(402).json({ error: 'payment_verification_failed', details: verify });
    }

    console.log(`[RESOURCE] Payment verified: ${verify.success}`);

    await db.update(schema.paymentLogs).set({
      paymentStatus: 'VERIFIED',
      riskLevel: verify?.riskProfile?.level,
      riskRationale: verify?.reason,
      timestamp: new Date(),
      paymentPayload: paymentHeader,
    }).where(eq(schema.paymentLogs.correlationId, correlationId));

  } catch (e) {


    await db.update(schema.paymentLogs).set({
      paymentStatus: 'VERIFICATION_ERROR',
      riskRationale: String(e),
      timestamp: new Date(),
      paymentPayload: paymentHeader,
    }).where(eq(schema.paymentLogs.correlationId, correlationId));

    return res.status(502).json({ error: 'facilitator_unreachable', details: String(e) });
  }

  // Process request
  const result = await summarize(req.body || {});

  // Settle via facilitator, pass user chain for cross-chain support
  try {
    const settle = await settlePayment(paymentHeader, userChain, TARGET_CHAIN, ADDRESS, correlationId);
    // Try to read facilitator response and create X-PAYMENT-RESPONSE
    const resp = settle.data || {};
    const responsePayload = { 
      success: !!resp.success, 
      transaction: resp.transaction || null, 
      network: resp.network || TARGET_CHAIN, 
      payer: resp.payer || null,
      crossChain: resp.crossChain || null
    };

    await db.update(schema.paymentLogs).set({
      paymentStatus: resp.success ? 'SETTLEMENT_SUCCESS' : 'SETTLEMENT_FAILED',
      settlementTxHash: resp.transaction,
      settlementTxUrl: resp.transaction && resp.network ? `${explorerUrlMap[resp.network]}${resp.transaction}` : null,
      timestamp: new Date(),
    }).where(eq(schema.paymentLogs.correlationId, correlationId));

    const b64 = Buffer.from(JSON.stringify(responsePayload)).toString('base64');
    res.setHeader('X-PAYMENT-RESPONSE', b64);
  } catch (e) {
    // If settle failed, continue but include header with error
    const errPayload = { success: false, error: String(e) };
    const b64 = Buffer.from(JSON.stringify(errPayload)).toString('base64');
    res.setHeader('X-PAYMENT-RESPONSE', b64);
  }

  res.json({ result });
});

app.get('/healthz', (_req: any, res: any) => res.json({ ok: true, facilitator: FACILITATOR_URL }));

app.listen(PORT, () => {
  console.log(`[RESOURCE-SERVER] listening on port ${PORT}`);
  console.log(`Facilitator: ${FACILITATOR_URL}`);
  console.log(`Target Chain: ${TARGET_CHAIN}`);
});
