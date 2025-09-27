import "dotenv/config";

import { client, db } from "@/database";
// import { paymentLogs } from "@/schema";

const times = (v: number) =>
  Array(v)
    .fill(null)
    .map((_, i) => i + 1);

const main = async (): Promise<void> => {

  // Seed paymentLogs table with dummy data
  // for (const i of times(5)) {
  //   await db.insert(paymentLogs).values({
  //     correlationId: `test-correlation-${i}`,
  //     clientAgentUrl: `http://localhost:3000/client-${i}`,
  //     serviceAgentUrl: `http://localhost:3001/service-${i}`,
  //     facilitatorUrl: `http://localhost:3002/facilitator-${i}`,
  //     paymentStatus: i % 2 === 0 ? 'REQUEST_INITIATED' : 'REQUEST_COMPLETED',
  //     timestamp: new Date(),
  //   });
  // }

  await client.end();
  process.exit(0);
};

void main();
