ALTER TABLE "tron_transactions" ADD COLUMN "sweep_tx_hash" VARCHAR(128);
ALTER TABLE "tron_transactions" ADD COLUMN "swept_at" TIMESTAMP(3);

CREATE TABLE "payment_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "master_wallet_address" VARCHAR(64),
    "updated_by" BIGINT,
    "dateupdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "payment_settings" ("id") VALUES (1);
