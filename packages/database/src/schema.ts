import { pgTable, serial, text, varchar, timestamp } from "drizzle-orm/pg-core";

export const paymentLogs = pgTable("payment_logs", {
  id: serial("id").primaryKey(),
  correlationId: varchar("correlation_id", { length: 256 }).notNull().unique(),
  clientAgentUrl: varchar("client_agent_url", { length: 256 }),
  resourceServerUrl: varchar("resource_server_url", { length: 256 }),
  serviceAgentUrl: varchar("service_agent_url", { length: 256 }),
  facilitatorUrl: varchar("facilitator_url", { length: 256 }),
  paymentStatus: varchar("payment_status", { length: 256 }),
  riskLevel: varchar("risk_level", { length: 256 }),
  riskRationale: text("risk_rationale"),
  paymentPayload: text("payment_payload"),
  settlementTxHash: varchar("settlement_tx_hash", { length: 256 }),
  verificationTxHash: varchar("verification_tx_hash", { length: 256 }),
  verificationTxUrl: varchar("verification_tx_url", { length: 256 }),
  settlementTxUrl: varchar("settlement_tx_url", { length: 256 }),
  userChain: varchar("user_chain", { length: 256 }),
  serverChain: varchar("server_chain", { length: 256 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const schema = { paymentLogs };
