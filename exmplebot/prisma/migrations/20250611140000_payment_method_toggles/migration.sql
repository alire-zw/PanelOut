ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "tron_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "payment_settings" ADD COLUMN IF NOT EXISTS "rial_enabled" BOOLEAN NOT NULL DEFAULT false;
