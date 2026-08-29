ALTER TABLE "user_subscriptions"
ADD COLUMN IF NOT EXISTS "volume_remaining_15gb_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "volume_remaining_10gb_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "volume_remaining_5gb_notified" BOOLEAN NOT NULL DEFAULT false;
