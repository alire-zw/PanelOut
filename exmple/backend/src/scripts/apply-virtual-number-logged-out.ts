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
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'virtualnumber'`,
    )
    const names = new Set(cols.map((row) => String(row.name)))

    if (!names.has('logged_out_at')) {
      await connection.query(`
        ALTER TABLE virtualnumber
        ADD COLUMN logged_out_at DATETIME(3) NULL AFTER code_received_at
      `)
      console.log('OK: added logged_out_at')
    } else {
      console.log('SKIP: logged_out_at exists')
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
