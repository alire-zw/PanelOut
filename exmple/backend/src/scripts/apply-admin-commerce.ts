import '../config/env.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL missing')

  const sql = readFileSync(resolve('prisma/admin-commerce.sql'), 'utf8')
  const statements = sql
    .split(/;\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)

  const connection = await mysql.createConnection(url)
  try {
    for (const statement of statements) {
      await connection.query(statement)
      console.log('OK:', statement.slice(0, 48).replace(/\s+/g, ' '), '…')
    }
  } finally {
    await connection.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
