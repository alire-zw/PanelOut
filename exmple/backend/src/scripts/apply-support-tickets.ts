import '../config/env.js'
import mysql from 'mysql2/promise'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')

  const connection = await mysql.createConnection(url)
  try {
    // MySQL < 8.0.29 may not support ADD COLUMN IF NOT EXISTS — probe columns first
    const [cols] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets'`,
    )
    const names = new Set(cols.map((row) => String(row.name)))

    if (!names.has('category')) {
      await connection.query(`
        ALTER TABLE support_tickets
        ADD COLUMN category ENUM('sales', 'product', 'kyc', 'wallet', 'other')
          NOT NULL DEFAULT 'other' AFTER user_id
      `)
      console.log('OK: added category')
    } else {
      console.log('SKIP: category exists')
    }

    if (!names.has('order_id')) {
      await connection.query(`
        ALTER TABLE support_tickets
        ADD COLUMN order_id VARCHAR(64) NULL AFTER category
      `)
      console.log('OK: added order_id')
    } else {
      console.log('SKIP: order_id exists')
    }

    const [indexes] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT INDEX_NAME AS name
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_tickets'`,
    )
    const indexNames = new Set(indexes.map((row) => String(row.name)))

    if (!indexNames.has('support_tickets_user_id_updated_at_idx')) {
      await connection.query(`
        CREATE INDEX support_tickets_user_id_updated_at_idx
        ON support_tickets(user_id, updated_at)
      `)
      console.log('OK: user_id+updated_at index')
    }

    if (!indexNames.has('support_tickets_order_id_idx')) {
      await connection.query(`
        CREATE INDEX support_tickets_order_id_idx ON support_tickets(order_id)
      `)
      console.log('OK: order_id index')
    }

    // FK to orders.order_id (optional; ignore if already present / fails)
    try {
      await connection.query(`
        ALTER TABLE support_tickets
        ADD CONSTRAINT support_tickets_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES orders(order_id)
        ON DELETE SET NULL ON UPDATE CASCADE
      `)
      console.log('OK: order FK')
    } catch (error) {
      console.log(
        'SKIP: order FK',
        error instanceof Error ? error.message.slice(0, 80) : 'unknown',
      )
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
