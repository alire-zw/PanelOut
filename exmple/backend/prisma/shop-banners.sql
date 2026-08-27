CREATE TABLE IF NOT EXISTS `shop_banners` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(128) NOT NULL,
  `product_key` VARCHAR(96) NOT NULL,
  `main_image_url` VARCHAR(512) NOT NULL,
  `thumb_image_url` VARCHAR(512) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `shop_banners_is_active_sort_order_idx` (`is_active`, `sort_order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
