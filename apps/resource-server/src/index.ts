import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { getEnv } from './env';
import { buildPaymentRequirements, verifyPayment, settlePayment } from './x402';
import { summarize } from './premium/summarize';
import { getUsdcAddressForChain } from './utils/helpers';

const app = express();
app.use(cors({ exposedHeaders: ['X-PAYMENT-RESPONSE'] }));
app.use(bodyParser.json());

const { PORT, RESOURCE_SERVER_ADDRESS: ADDRESS, FACILITATOR_URL, FACILITATOR_ADDRESS, TARGET_CHAIN } = getEnv();

app.post('/premium/summarize', async (req: any, res: any) => {
  const paymentHeader = req.headers['x-payment'] as string | undefined;
  const userChain = req.headers['x-user-chain'] as string | undefined;
  
  console.log(`[RESOURCE] Request received:`, {
    hasPayment: !!paymentHeader,
    userChain,
    targetChain: TARGET_CHAIN,
    isCrossChain: userChain && userChain !== TARGET_CHAIN,
  });
  
  // If no payment header, return 402 with accepts
  if (!paymentHeader) {
    const resourceUrl = `http://localhost:${PORT}/premium/summarize`;
    const accepts = [buildPaymentRequirements(resourceUrl, FACILITATOR_ADDRESS, getUsdcAddressForChain(TARGET_CHAIN), TARGET_CHAIN)];
    return res.status(402).json({ accepts });
  }

  // Verify via facilitator
  try {
    const verify = await verifyPayment(paymentHeader);
    if (!verify || !verify.success) {
      return res.status(402).json({ error: 'payment_verification_failed', details: verify });
    }

    console.log(`[RESOURCE] Payment verified: ${verify.success}`);
  } catch (e) {
    return res.status(502).json({ error: 'facilitator_unreachable', details: String(e) });
  }

  // Process request
  const result = await summarize(req.body || {});

  // Settle via facilitator, pass user chain for cross-chain support
  try {
    const settle = await settlePayment(paymentHeader, userChain, TARGET_CHAIN, ADDRESS);
    // Try to read facilitator response and create X-PAYMENT-RESPONSE
    const resp = settle.data || {};
    const responsePayload = { 
      success: !!resp.success, 
      transaction: resp.transaction || null, 
      network: TARGET_CHAIN, 
      payer: resp.payer || null,
      crossChain: resp.crossChain || null
    };
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
