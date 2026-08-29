CREATE TABLE "servers" (
    "id" BIGSERIAL NOT NULL,
    "server_name" VARCHAR(255) NOT NULL,
    "server_ip" VARCHAR(255) NOT NULL,
    "server_domain" VARCHAR(500),
    "port" INTEGER NOT NULL,
    "user_name" VARCHAR(255) NOT NULL,
    "user_password" VARCHAR(255) NOT NULL,
    "remark" TEXT,
    "sub_public_base_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sales_enabled" BOOLEAN NOT NULL DEFAULT true,
    "renewal_enabled" BOOLEAN NOT NULL DEFAULT true,
    "datecreated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateupdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "servers_is_active_idx" ON "servers"("is_active");
CREATE INDEX "servers_datecreated_idx" ON "servers"("datecreated");
