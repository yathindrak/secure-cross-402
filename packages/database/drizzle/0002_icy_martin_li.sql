ALTER TABLE "payment_logs" ADD COLUMN "verification_tx_hash" varchar(256);--> statement-breakpoint
ALTER TABLE "payment_logs" ADD COLUMN "verification_tx_url" varchar(256);--> statement-breakpoint
ALTER TABLE "payment_logs" ADD COLUMN "settlement_tx_url" varchar(256);--> statement-breakpoint
ALTER TABLE "payment_logs" DROP COLUMN IF EXISTS "transaction_url";