import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const prismaClient = path.join(root, 'node_modules', '@prisma', 'client', 'index.js')

function run(command, args) {
  return spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

const generate = run('npx', ['prisma', 'generate'])
if (generate.status !== 0) {
  const locked = process.platform === 'win32' && existsSync(prismaClient)
  if (!locked) {
    process.exit(generate.status ?? 1)
  }
  console.warn(
    '[build] prisma generate failed (engine likely locked by a running process); using existing Prisma Client',
  )
}

const compile = run('npx', ['tsc'])
process.exit(compile.status ?? 1)
