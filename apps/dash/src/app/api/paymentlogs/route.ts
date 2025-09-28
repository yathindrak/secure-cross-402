import { db, schema } from '@repo/database';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const correlationId = searchParams.get('correlationId');

  if (correlationId) {
    const logs = await db.query.paymentLogs.findMany({
      where: eq(schema.paymentLogs.correlationId, correlationId),
      orderBy: schema.paymentLogs.timestamp,
    });
    return NextResponse.json(logs);
  } else {
    const logs = await db.query.paymentLogs.findMany({
      orderBy: schema.paymentLogs.timestamp,
    });
    return NextResponse.json(logs);
  }
}
