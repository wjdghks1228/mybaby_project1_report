ALTER TABLE families ADD COLUMN record_epoch INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE families ADD COLUMN reset_id TEXT;
