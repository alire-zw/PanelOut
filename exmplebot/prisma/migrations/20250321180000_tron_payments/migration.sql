-- CreateTable
CREATE TABLE "tron_wallets" (
    "id" BIGSERIAL NOT NULL,
    "userid" BIGINT NOT NULL,
    "address" VARCHAR(64) NOT NULL,
    "private_key" VARCHAR(128) NOT NULL,
    "public_key" VARCHAR(256) NOT NULL,
    "last_checked_at" TIMESTAMP(3),
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateupdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tron_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tron_transactions" (
    "id" BIGSERIAL NOT NULL,
    "userid" BIGINT NOT NULL,
    "walletid" BIGINT NOT NULL,
    "txhash" VARCHAR(128) NOT NULL,
    "from_address" VARCHAR(64) NOT NULL,
    "to_address" VARCHAR(64) NOT NULL,
    "amount_sun" BIGINT NOT NULL,
    "amount_trx" VARCHAR(32) NOT NULL,
    "trx_price_irt" BIGINT NOT NULL,
    "amount_irt" BIGINT NOT NULL,
    "block_number" BIGINT,
    "block_timestamp" TIMESTAMP(3),
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tron_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tron_wallets_userid_key" ON "tron_wallets"("userid");

-- CreateIndex
CREATE UNIQUE INDEX "tron_wallets_address_key" ON "tron_wallets"("address");

-- CreateIndex
CREATE INDEX "tron_wallets_address_idx" ON "tron_wallets"("address");

-- CreateIndex
CREATE UNIQUE INDEX "tron_transactions_txhash_key" ON "tron_transactions"("txhash");

-- CreateIndex
CREATE INDEX "tron_transactions_userid_idx" ON "tron_transactions"("userid");

-- CreateIndex
CREATE INDEX "tron_transactions_walletid_idx" ON "tron_transactions"("walletid");

-- CreateIndex
CREATE INDEX "tron_transactions_datecreated_idx" ON "tron_transactions"("datecreated");

-- AddForeignKey
ALTER TABLE "tron_wallets" ADD CONSTRAINT "tron_wallets_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tron_transactions" ADD CONSTRAINT "tron_transactions_walletid_fkey" FOREIGN KEY ("walletid") REFERENCES "tron_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
