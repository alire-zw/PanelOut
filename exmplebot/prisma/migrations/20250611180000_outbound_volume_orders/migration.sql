-- CreateTable
CREATE TABLE "outbound_volume_orders" (
    "id" BIGSERIAL NOT NULL,
    "userid" BIGINT NOT NULL,
    "volume_gb" INTEGER NOT NULL,
    "price_per_gb" INTEGER NOT NULL,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "amount_irt" BIGINT NOT NULL,
    "payment_method" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "receipt_file_id" VARCHAR(256),
    "receipt_type" VARCHAR(16),
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(3),
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_volume_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_volume_order_admin_messages" (
    "id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "message_id" BIGINT NOT NULL,

    CONSTRAINT "outbound_volume_order_admin_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outbound_volume_orders_userid_idx" ON "outbound_volume_orders"("userid");

-- CreateIndex
CREATE INDEX "outbound_volume_orders_status_idx" ON "outbound_volume_orders"("status");

-- CreateIndex
CREATE INDEX "outbound_volume_orders_datecreated_idx" ON "outbound_volume_orders"("datecreated");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_volume_order_admin_messages_order_id_admin_id_key" ON "outbound_volume_order_admin_messages"("order_id", "admin_id");

-- AddForeignKey
ALTER TABLE "outbound_volume_orders" ADD CONSTRAINT "outbound_volume_orders_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_volume_order_admin_messages" ADD CONSTRAINT "outbound_volume_order_admin_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "outbound_volume_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
