-- CreateTable
CREATE TABLE "channels" (
    "id" BIGSERIAL NOT NULL,
    "channel_id" BIGINT NOT NULL,
    "channel_name" VARCHAR(255) NOT NULL,
    "channel_username" VARCHAR(255),
    "button_label" VARCHAR(255) NOT NULL DEFAULT 'تایید عضویت',
    "invite_link" VARCHAR(500),
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "member_count" INTEGER NOT NULL DEFAULT 0,
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateupdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_channel_id_key" ON "channels"("channel_id");

-- CreateIndex
CREATE INDEX "channels_is_locked_idx" ON "channels"("is_locked");

-- CreateIndex
CREATE INDEX "channels_datecreated_idx" ON "channels"("datecreated");
