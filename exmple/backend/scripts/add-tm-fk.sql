ALTER TABLE `telegram_member_orders` ADD CONSTRAINT `telegram_member_orders_order_db_id_fkey` FOREIGN KEY (`order_db_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
