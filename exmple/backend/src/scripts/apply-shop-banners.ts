import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'
import { databaseUrl } from '../config/env.js'

async function main() {
  const sqlPath = resolve(process.cwd(), 'prisma/shop-banners.sql')
  const sql = readFileSync(sqlPath, 'utf8')
  const conn = await mysql.createConnection(databaseUrl)
  try {
    await conn.query(sql)
    console.log('shop_banners table ready')
  } finally {
    await conn.end()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
