import { sendMessage } from './a2a';
import { getEnv } from './env';
import { db, schema } from '@repo/database';
import { eq } from 'drizzle-orm';

export async function main() {
  const { SERVICE_AGENT_URL } = getEnv();
  const input = { text: 'This is a long text to summarize for testing the premium summarize skill.' };
  const correlationId = `REQ-${Date.now()}`;

  console.log(`[CLIENT] Request initiated with correlationId: ${correlationId}`);
  // Initial log entry for the request
  await db.insert(schema.paymentLogs).values({
    correlationId,
    clientAgentUrl: `http://localhost:${SERVICE_AGENT_URL}`,
    paymentStatus: 'REQUEST_INITIATED',
    timestamp: new Date(),
  });
  console.log(`[CLIENT] Request logged to database with correlationId: ${correlationId}`);

  try {
    const resp = await sendMessage(SERVICE_AGENT_URL, 'premium.summarize', input, correlationId);
    console.log('A2A response:', JSON.stringify(resp, null, 2));

    // Log final response
    await db.update(schema.paymentLogs).set({
      paymentStatus: 'REQUEST_COMPLETED',
      timestamp: new Date(),
    }).where(eq(schema.paymentLogs.correlationId, correlationId));

  } catch (e: any) {
    console.error('error', e);
    
    // Log errors from the A2A response, especially 402 challenges
    if (e.response && e.response.status === 402) {
      console.log('Received 402 Payment Required', e.response.data);
      await db.update(schema.paymentLogs).set({
        paymentStatus: 'PAYMENT_REQUIRED',
        riskRationale: JSON.stringify(e.response.data),
        timestamp: new Date(),
      }).where(eq(schema.paymentLogs.correlationId, correlationId));
    } else {
      await db.update(schema.paymentLogs).set({
        paymentStatus: 'REQUEST_FAILED',
        riskRationale: String(e),
        timestamp: new Date(),
      }).where(eq(schema.paymentLogs.correlationId, correlationId));
    }
    process.exit(1);
  }
}

// Run when executed directly
main().catch(e => { console.error(e); process.exit(1); });
