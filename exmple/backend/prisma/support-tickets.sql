-- Support ticket category + optional order link

CREATE TABLE IF NOT EXISTS `_tmp_support_ticket_category` (
  `value` ENUM('sales', 'product', 'kyc', 'wallet', 'other') NOT NULL
);

ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `category` ENUM('sales', 'product', 'kyc', 'wallet', 'other') NOT NULL DEFAULT 'other' AFTER `user_id`;

ALTER TABLE `support_tickets`
  ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(64) NULL AFTER `category`;

CREATE INDEX IF NOT EXISTS `support_tickets_user_id_updated_at_idx` ON `support_tickets`(`user_id`, `updated_at`);
CREATE INDEX IF NOT EXISTS `support_tickets_order_id_idx` ON `support_tickets`(`order_id`);
