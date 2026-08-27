-- Admin system channels (3 fixed slots)
CREATE TABLE IF NOT EXISTS `admin_system_channels` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `slot_key` ENUM('admin_report', 'purchase_report', 'notification') NOT NULL,
  `chat_id` BIGINT NOT NULL,
  `username` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `admin_system_channels_slot_key_key` (`slot_key`),
  INDEX `admin_system_channels_chat_id_idx` (`chat_id`),
  INDEX `admin_system_channels_is_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
