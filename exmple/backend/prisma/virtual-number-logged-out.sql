-- virtualnumber.logged_out_at
-- Prefer: npx tsx src/scripts/apply-virtual-number-logged-out.ts
ALTER TABLE `virtualnumber`
  ADD COLUMN `logged_out_at` DATETIME(3) NULL AFTER `code_received_at`;
