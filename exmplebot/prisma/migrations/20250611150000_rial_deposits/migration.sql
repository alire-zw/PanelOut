CREATE TABLE "rial_deposits" (
    "id" BIGSERIAL NOT NULL,
    "userid" BIGINT NOT NULL,
    "amount_irt" BIGINT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "receipt_file_id" VARCHAR(256) NOT NULL,
    "receipt_type" VARCHAR(16) NOT NULL,
    "reviewed_by" BIGINT,
    "reviewed_at" TIMESTAMP(3),
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rial_deposits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rial_deposit_admin_messages" (
    "id" BIGSERIAL NOT NULL,
    "deposit_id" BIGINT NOT NULL,
    "admin_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "message_id" BIGINT NOT NULL,

    CONSTRAINT "rial_deposit_admin_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rial_deposit_admin_messages_deposit_id_admin_id_key" ON "rial_deposit_admin_messages"("deposit_id", "admin_id");
CREATE INDEX "rial_deposits_userid_idx" ON "rial_deposits"("userid");
CREATE INDEX "rial_deposits_status_idx" ON "rial_deposits"("status");
CREATE INDEX "rial_deposits_datecreated_idx" ON "rial_deposits"("datecreated");

ALTER TABLE "rial_deposits" ADD CONSTRAINT "rial_deposits_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("userid") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rial_deposit_admin_messages" ADD CONSTRAINT "rial_deposit_admin_messages_deposit_id_fkey" FOREIGN KEY ("deposit_id") REFERENCES "rial_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
