import '../config/env.js'
import mysql from 'mysql2/promise'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')
  const connection = await mysql.createConnection(url)
  try {
    const [cols] = await connection.query<mysql.RowDataPacket[]>(
      `SELECT COLUMN_NAME AS name
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'support_ticket_messages'`,
    )
    const names = new Set(cols.map((row) => String(row.name)))
    if (!names.has('image_data')) {
      await connection.query(`
        ALTER TABLE support_ticket_messages
        ADD COLUMN image_data LONGTEXT NULL AFTER body
      `)
      console.log('OK: image_data')
    } else {
      console.log('SKIP: image_data exists')
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
