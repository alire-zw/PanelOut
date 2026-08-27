CREATE TABLE IF NOT EXISTS `club_rewards` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(128) NOT NULL,
  `description` VARCHAR(512) NOT NULL,
  `points_cost` INTEGER NOT NULL,
  `reward_type` ENUM('percent_discount', 'fixed_discount', 'free_item', 'custom') NOT NULL,
  `reward_value` VARCHAR(255) NOT NULL,
  `stock` INTEGER NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `club_rewards_is_active_sort_order_idx`(`is_active`, `sort_order`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `club_reward_redemptions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `reward_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `points_spent` INTEGER NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `club_reward_redemptions_user_id_idx`(`user_id`),
  INDEX `club_reward_redemptions_reward_id_idx`(`reward_id`),
  CONSTRAINT `club_reward_redemptions_reward_id_fkey` FOREIGN KEY (`reward_id`) REFERENCES `club_rewards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `club_reward_redemptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `discount_codes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(64) NOT NULL,
  `title` VARCHAR(128) NOT NULL,
  `description` VARCHAR(512) NULL,
  `discount_type` ENUM('percent', 'fixed') NOT NULL,
  `discount_value` INTEGER NOT NULL,
  `max_uses` INTEGER NULL,
  `used_count` INTEGER NOT NULL DEFAULT 0,
  `min_order_toman` BIGINT NULL,
  `product_key` VARCHAR(96) NULL,
  `starts_at` DATETIME(3) NULL,
  `expires_at` DATETIME(3) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `discount_codes_code_key`(`code`),
  INDEX `discount_codes_is_active_idx`(`is_active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_pricing` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `product_key` VARCHAR(96) NOT NULL,
  `label` VARCHAR(128) NOT NULL,
  `markup_percent` INTEGER NOT NULL DEFAULT 0,
  `fixed_add_toman` BIGINT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `note` VARCHAR(255) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `product_pricing_product_key_key`(`product_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `ticket_code` VARCHAR(32) NOT NULL,
  `user_id` INTEGER NOT NULL,
  `subject` VARCHAR(160) NOT NULL,
  `status` ENUM('open', 'answered', 'closed') NOT NULL DEFAULT 'open',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `support_tickets_ticket_code_key`(`ticket_code`),
  INDEX `support_tickets_user_id_idx`(`user_id`),
  INDEX `support_tickets_status_updated_at_idx`(`status`, `updated_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `support_tickets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `support_ticket_messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `ticket_id` INTEGER NOT NULL,
  `sender_role` VARCHAR(16) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `support_ticket_messages_ticket_id_created_at_idx`(`ticket_id`, `created_at`),
  CONSTRAINT `support_ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
