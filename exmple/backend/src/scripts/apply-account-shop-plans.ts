import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { databaseUrl } from '../config/env.js'

async function hasColumn(conn: mysql.Connection, columnName: string) {
  const [rows] = await conn.query('SHOW COLUMNS FROM `account_shop_plans` WHERE Field = ?', [
    columnName,
  ])
  return Array.isArray(rows) && rows.length > 0
}

async function main() {
  const sqlPath = resolve(process.cwd(), 'prisma/account-shop-plans.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  const conn = await mysql.createConnection(databaseUrl)
  try {
    await conn.query(sql)
    if (!(await hasColumn(conn, 'notice_kind'))) {
      await conn.query(
        "ALTER TABLE `account_shop_plans` ADD COLUMN `notice_kind` VARCHAR(16) NOT NULL DEFAULT 'none' AFTER `custom_fields`",
      )
      console.log('added notice_kind')
    }
    if (!(await hasColumn(conn, 'notice_text'))) {
      await conn.query(
        'ALTER TABLE `account_shop_plans` ADD COLUMN `notice_text` VARCHAR(500) NULL AFTER `notice_kind`',
      )
      console.log('added notice_text')
    }
    console.log('account_shop_plans table ready')
  } finally {
    await conn.end()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
