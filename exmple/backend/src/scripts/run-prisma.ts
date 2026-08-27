import { execSync } from 'node:child_process'
import '../config/env.js'

const command = process.argv.slice(2).join(' ')

if (!command) {
  console.error('Usage: tsx src/scripts/run-prisma.ts <prisma-command>')
  process.exit(1)
}

execSync(`npx prisma ${command}`, {
  stdio: 'inherit',
  env: process.env,
})
