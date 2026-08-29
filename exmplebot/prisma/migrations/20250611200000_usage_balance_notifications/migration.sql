ALTER TABLE "user_subscriptions"
ADD COLUMN IF NOT EXISTS "low_balance_5gb_notified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "suspended_notified" BOOLEAN NOT NULL DEFAULT false;
