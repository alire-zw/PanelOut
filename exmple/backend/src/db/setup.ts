import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { databaseUrl, env } from '../config/env.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const prismaClientTypesPath = path.join(backendRoot, 'node_modules/.prisma/client/index.d.ts')

const expectedUsersColumnOrder = [
  'id',
  'telegram_id',
  'username',
  'first_name',
  'last_name',
  'real_name',
  'phone_number',
  'phone_verified_at',
  'national_id',
  'birth_date',
  'terms_accepted_at',
  'shahkar_matched_at',
  'kyc_verified_at',
  'email',
  'balance',
  'club_points',
  'role',
  'is_premium',
  'is_banned',
  'is_active',
  'language_code',
  'created_at',
  'updated_at',
] as const

function escapeIdentifier(value: string): string {
  return value.replace(/`/g, '``')
}

function generatePrismaClient(): void {
  execSync('npx prisma generate', {
    cwd: backendRoot,
    stdio: 'pipe',
  })
}

function prismaClientIsStale(): boolean {
  if (!fs.existsSync(prismaClientTypesPath)) {
    return true
  }

  const content = fs.readFileSync(prismaClientTypesPath, 'utf8')
  return (
    !content.includes('isPremium') ||
    content.includes('balance: Decimal') ||
    !content.includes('balance: bigint') ||
    !content.includes('clubPoints') ||
    !content.includes('PaymentStatus') ||
    !content.includes('CryptoPaymentStatus') ||
    !content.includes('OrderStatus') ||
    !content.includes('kycVerifiedAt') ||
    !content.includes('termsAcceptedAt') ||
    !content.includes('BankCard') ||
    !content.includes('ProductViewStat') ||
    !content.includes('SiteOnlineStat') ||
    !content.includes('ShopBanner') ||
    !content.includes('AccountShopPlan') ||
    !content.includes('noticeKind') ||
    !content.includes('AccountShopOrder') ||
    !content.includes('AccountShopOrderStatus')
  )
}

async function databaseHasPaymentsTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['payments'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasTronWalletsTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['tron_wallets'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasTransfersTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['transfers'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasShopCategoriesTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['shop_categories'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasOrdersTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['orders'])
  return Array.isArray(rows) && rows.length > 0
}

async function ordersTableHasColumn(connection: mysql.Connection, columnName: string): Promise<boolean> {
  const [rows] = await connection.query('SHOW COLUMNS FROM `orders` WHERE Field = ?', [columnName])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasProductViewStatsTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['product_view_stats'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasSiteOnlineStatsTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['site_online_stats'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasShopBannersTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['shop_banners'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasAccountShopPlansTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['account_shop_plans'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasAccountShopOrdersTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['account_shop_orders'])
  return Array.isArray(rows) && rows.length > 0
}

async function accountShopPlansTableHasColumn(
  connection: mysql.Connection,
  columnName: string,
): Promise<boolean> {
  const [rows] = await connection.query('SHOW COLUMNS FROM `account_shop_plans` WHERE Field = ?', [
    columnName,
  ])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasBankCardsTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['bank_cards'])
  return Array.isArray(rows) && rows.length > 0
}

async function databaseHasUsersTable(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW TABLES LIKE ?', ['users'])
  return Array.isArray(rows) && rows.length > 0
}

async function userIdIsNumeric(connection: mysql.Connection): Promise<boolean> {
  const [rows] = await connection.query('SHOW COLUMNS FROM users WHERE Field = ?', ['id'])
  if (!Array.isArray(rows) || rows.length === 0) {
    return false
  }

  const column = rows[0] as { Type?: string }
  return String(column.Type ?? '').toLowerCase().includes('int')
}

async function usersTableHasColumn(connection: mysql.Connection, columnName: string): Promise<boolean> {
  const [rows] = await connection.query('SHOW COLUMNS FROM users WHERE Field = ?', [columnName])
  return Array.isArray(rows) && rows.length > 0
}

async function getUsersTableColumns(
  connection: mysql.Connection,
): Promise<Array<{ Field: string; Type: string }>> {
  const [rows] = await connection.query('SHOW COLUMNS FROM users')
  return rows as Array<{ Field: string; Type: string }>
}

async function usersTableNeedsLayoutFix(connection: mysql.Connection): Promise<boolean> {
  const columns = await getUsersTableColumns(connection)
  const order = columns.map((column) => column.Field)

  if (order.join(',') !== expectedUsersColumnOrder.join(',')) {
    return true
  }

  const balanceColumn = columns.find((column) => column.Field === 'balance')
  return Boolean(balanceColumn?.Type.toLowerCase().includes('decimal'))
}

async function applyUsersTableLayout(connection: mysql.Connection): Promise<void> {
  await connection.query(`
    ALTER TABLE \`users\`
      MODIFY COLUMN \`telegram_id\` BIGINT NOT NULL AFTER \`id\`,
      MODIFY COLUMN \`username\` VARCHAR(64) NULL AFTER \`telegram_id\`,
      MODIFY COLUMN \`first_name\` VARCHAR(128) NULL AFTER \`username\`,
      MODIFY COLUMN \`last_name\` VARCHAR(128) NULL AFTER \`first_name\`,
      MODIFY COLUMN \`real_name\` VARCHAR(128) NULL AFTER \`last_name\`,
      MODIFY COLUMN \`phone_number\` VARCHAR(20) NULL AFTER \`real_name\`,
      MODIFY COLUMN \`phone_verified_at\` DATETIME(3) NULL AFTER \`phone_number\`,
      MODIFY COLUMN \`national_id\` VARCHAR(10) NULL AFTER \`phone_verified_at\`,
      MODIFY COLUMN \`birth_date\` DATE NULL AFTER \`national_id\`,
      MODIFY COLUMN \`terms_accepted_at\` DATETIME(3) NULL AFTER \`birth_date\`,
      MODIFY COLUMN \`shahkar_matched_at\` DATETIME(3) NULL AFTER \`terms_accepted_at\`,
      MODIFY COLUMN \`kyc_verified_at\` DATETIME(3) NULL AFTER \`shahkar_matched_at\`,
      MODIFY COLUMN \`email\` VARCHAR(255) NULL AFTER \`kyc_verified_at\`,
      MODIFY COLUMN \`balance\` BIGINT NOT NULL DEFAULT 0 AFTER \`email\`,
      MODIFY COLUMN \`club_points\` INT NOT NULL DEFAULT 0 AFTER \`balance\`,
      MODIFY COLUMN \`role\` ENUM('user', 'admin', 'supervisor') NOT NULL DEFAULT 'user' AFTER \`club_points\`,
      MODIFY COLUMN \`is_premium\` BOOLEAN NOT NULL DEFAULT false AFTER \`role\`,
      MODIFY COLUMN \`is_banned\` BOOLEAN NOT NULL DEFAULT false AFTER \`is_premium\`,
      MODIFY COLUMN \`is_active\` BOOLEAN NOT NULL DEFAULT true AFTER \`is_banned\`,
      MODIFY COLUMN \`language_code\` VARCHAR(16) NULL AFTER \`is_active\`,
      MODIFY COLUMN \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER \`language_code\`,
      MODIFY COLUMN \`updated_at\` DATETIME(3) NOT NULL AFTER \`created_at\`
  `)
}

function syncDatabaseSchema(acceptDataLoss = false): void {
  const args = ['db', 'push', '--skip-generate']
  if (acceptDataLoss) {
    args.push('--accept-data-loss')
  }

  execSync(`npx prisma ${args.join(' ')}`, {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
  })
}

export async function prepareDatabase(): Promise<void> {
  const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD || undefined,
  })

  let schemaChanged = false

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${escapeIdentifier(env.DB_NAME)}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )

    await connection.query(`USE \`${escapeIdentifier(env.DB_NAME)}\``)

    const hasUsersTable = await databaseHasUsersTable(connection)

    if (!hasUsersTable) {
      syncDatabaseSchema()
      schemaChanged = true
    } else if (!(await userIdIsNumeric(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'is_premium'))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'national_id'))) {
      syncDatabaseSchema()
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'phone_verified_at'))) {
      syncDatabaseSchema()
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'terms_accepted_at'))) {
      await connection.query(
        'ALTER TABLE `users` ADD COLUMN `terms_accepted_at` DATETIME(3) NULL AFTER `birth_date`',
      )
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'shahkar_matched_at'))) {
      await connection.query(
        'ALTER TABLE `users` ADD COLUMN `shahkar_matched_at` DATETIME(3) NULL AFTER `terms_accepted_at`',
      )
      schemaChanged = true
    } else if (!(await databaseHasBankCardsTable(connection))) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`bank_cards\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`user_id\` INT NOT NULL,
          \`card_number\` VARCHAR(16) NOT NULL,
          \`bank_name\` VARCHAR(128) NULL,
          \`bank_slug\` VARCHAR(64) NULL,
          \`bank_bin\` VARCHAR(8) NULL,
          \`is_primary\` BOOLEAN NOT NULL DEFAULT true,
          \`is_verified\` BOOLEAN NOT NULL DEFAULT false,
          \`matched_at\` DATETIME(3) NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updated_at\` DATETIME(3) NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`bank_cards_user_id_card_number_key\` (\`user_id\`, \`card_number\`),
          KEY \`bank_cards_user_id_idx\` (\`user_id\`),
          CONSTRAINT \`bank_cards_user_id_fkey\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      schemaChanged = true
    } else if (!(await usersTableHasColumn(connection, 'club_points'))) {
      await connection.query(
        'ALTER TABLE `users` ADD COLUMN `club_points` INT NOT NULL DEFAULT 0 AFTER `balance`',
      )
      schemaChanged = true
    } else if (await usersTableNeedsLayoutFix(connection)) {
      await applyUsersTableLayout(connection)
      schemaChanged = true
    } else if (!(await databaseHasPaymentsTable(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await databaseHasTronWalletsTable(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await databaseHasTransfersTable(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await databaseHasShopCategoriesTable(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await databaseHasOrdersTable(connection))) {
      syncDatabaseSchema(true)
      schemaChanged = true
    } else if (!(await ordersTableHasColumn(connection, 'wallet_amount_toman'))) {
      await connection.query(
        'ALTER TABLE `orders` ADD COLUMN `wallet_amount_toman` BIGINT NOT NULL DEFAULT 0 AFTER `amount_toman`',
      )
      schemaChanged = true
    } else if (
      !(await databaseHasProductViewStatsTable(connection)) ||
      !(await databaseHasSiteOnlineStatsTable(connection))
    ) {
      syncDatabaseSchema()
      schemaChanged = true
    } else if (!(await databaseHasShopBannersTable(connection))) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`shop_banners\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`title\` VARCHAR(128) NOT NULL,
          \`product_key\` VARCHAR(96) NOT NULL,
          \`main_image_url\` VARCHAR(512) NOT NULL,
          \`thumb_image_url\` VARCHAR(512) NOT NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`is_active\` BOOLEAN NOT NULL DEFAULT true,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updated_at\` DATETIME(3) NOT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`shop_banners_is_active_sort_order_idx\` (\`is_active\`, \`sort_order\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      schemaChanged = true
    } else if (!(await databaseHasAccountShopPlansTable(connection))) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`account_shop_plans\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`category_id\` VARCHAR(32) NOT NULL,
          \`name\` VARCHAR(160) NOT NULL,
          \`duration_label\` VARCHAR(96) NOT NULL,
          \`warranty_type\` VARCHAR(16) NOT NULL,
          \`warranty_days\` INT NULL,
          \`roboticvn_product_id\` VARCHAR(64) NOT NULL,
          \`roboticvn_variant_id\` VARCHAR(64) NOT NULL,
          \`roboticvn_variant_title\` VARCHAR(255) NOT NULL,
          \`pricing_mode\` VARCHAR(16) NOT NULL,
          \`fixed_toman\` INT NULL,
          \`markup_percent\` INT NOT NULL DEFAULT 0,
          \`custom_fields\` JSON NOT NULL,
          \`notice_kind\` VARCHAR(16) NOT NULL DEFAULT 'none',
          \`notice_text\` VARCHAR(500) NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`is_active\` BOOLEAN NOT NULL DEFAULT true,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updated_at\` DATETIME(3) NOT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`account_shop_plans_category_active_sort_idx\` (\`category_id\`, \`is_active\`, \`sort_order\`),
          INDEX \`account_shop_plans_variant_idx\` (\`roboticvn_variant_id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      schemaChanged = true
    } else {
      if (!(await accountShopPlansTableHasColumn(connection, 'notice_kind'))) {
        await connection.query(
          "ALTER TABLE `account_shop_plans` ADD COLUMN `notice_kind` VARCHAR(16) NOT NULL DEFAULT 'none' AFTER `custom_fields`",
        )
        schemaChanged = true
      }
      if (!(await accountShopPlansTableHasColumn(connection, 'notice_text'))) {
        await connection.query(
          'ALTER TABLE `account_shop_plans` ADD COLUMN `notice_text` VARCHAR(500) NULL AFTER `notice_kind`',
        )
        schemaChanged = true
      }
    }

    if (!(await databaseHasAccountShopOrdersTable(connection))) {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`account_shop_orders\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`order_db_id\` INT NOT NULL,
          \`plan_id\` INT NOT NULL,
          \`account_category_id\` VARCHAR(32) NOT NULL,
          \`plan_name\` VARCHAR(160) NOT NULL,
          \`duration_label\` VARCHAR(96) NOT NULL,
          \`warranty_label\` VARCHAR(96) NOT NULL,
          \`field_values_json\` JSON NOT NULL,
          \`custom_fields_json\` JSON NOT NULL,
          \`toman\` INT NOT NULL,
          \`status\` ENUM('registered', 'processing', 'delivered') NOT NULL DEFAULT 'registered',
          \`delivered_at\` DATETIME(3) NULL,
          \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updated_at\` DATETIME(3) NOT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`account_shop_orders_order_db_id_key\` (\`order_db_id\`),
          INDEX \`account_shop_orders_plan_id_idx\` (\`plan_id\`),
          INDEX \`account_shop_orders_account_category_id_idx\` (\`account_category_id\`),
          INDEX \`account_shop_orders_status_idx\` (\`status\`),
          CONSTRAINT \`account_shop_orders_order_db_id_fkey\`
            FOREIGN KEY (\`order_db_id\`) REFERENCES \`orders\`(\`id\`)
            ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      schemaChanged = true
    }
  } finally {
    await connection.end()
  }

  if (schemaChanged || prismaClientIsStale()) {
    generatePrismaClient()
  }
}
