CREATE TABLE IF NOT EXISTS "payment_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"correlation_id" varchar(256) NOT NULL,
	"client_agent_url" varchar(256),
	"service_agent_url" varchar(256),
	"facilitator_url" varchar(256),
	"payment_status" varchar(256),
	"risk_level" varchar(256),
	"risk_rationale" text,
	"payment_payload" text,
	"settlement_tx_hash" varchar(256),
	"transaction_url" varchar(256),
	"user_chain" varchar(256),
	"server_chain" varchar(256),
	"timestamp" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_logs_correlation_id_unique" UNIQUE("correlation_id")
);
