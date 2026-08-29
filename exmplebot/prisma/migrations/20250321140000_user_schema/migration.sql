-- DropTable
DROP TABLE IF EXISTS "users";

-- CreateTable
CREATE TABLE "users" (
    "id" BIGSERIAL NOT NULL,
    "userid" BIGINT NOT NULL,
    "username" VARCHAR(64),
    "userfullname" VARCHAR(256) NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "ispremium" BOOLEAN NOT NULL DEFAULT false,
    "isbanned" BOOLEAN NOT NULL DEFAULT false,
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateupdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userid_key" ON "users"("userid");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_datecreated_idx" ON "users"("datecreated");
