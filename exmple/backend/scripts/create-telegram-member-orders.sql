CREATE TABLE IF NOT EXISTS `telegram_member_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_db_id` INT NOT NULL,
  `channel_link` VARCHAR(512) NOT NULL,
  `channel_username` VARCHAR(64) NOT NULL,
  `channel_title` VARCHAR(128) NOT NULL,
  `channel_photo` TEXT NULL,
  `channel_subscribers` VARCHAR(64) NULL,
  `service_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `rate` INT NOT NULL,
  `toman` INT NOT NULL,
  `provider_order_id` VARCHAR(64) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `telegram_member_orders_order_db_id_key`(`order_db_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
