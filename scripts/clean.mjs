import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
for (const path of ['lib', '.build']) {
  rmSync(resolve(root, path), { recursive: true, force: true })
}
