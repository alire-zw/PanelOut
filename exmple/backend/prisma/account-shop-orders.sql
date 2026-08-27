CREATE TABLE IF NOT EXISTS `account_shop_orders` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_db_id` INT NOT NULL,
  `plan_id` INT NOT NULL,
  `account_category_id` VARCHAR(32) NOT NULL,
  `plan_name` VARCHAR(160) NOT NULL,
  `duration_label` VARCHAR(96) NOT NULL,
  `warranty_label` VARCHAR(96) NOT NULL,
  `field_values_json` JSON NOT NULL,
  `custom_fields_json` JSON NOT NULL,
  `toman` INT NOT NULL,
  `status` ENUM('registered', 'processing', 'delivered') NOT NULL DEFAULT 'registered',
  `delivery_note` TEXT NULL,
  `delivered_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `account_shop_orders_order_db_id_key` (`order_db_id`),
  INDEX `account_shop_orders_plan_id_idx` (`plan_id`),
  INDEX `account_shop_orders_account_category_id_idx` (`account_category_id`),
  INDEX `account_shop_orders_status_idx` (`status`),
  CONSTRAINT `account_shop_orders_order_db_id_fkey`
    FOREIGN KEY (`order_db_id`) REFERENCES `orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
