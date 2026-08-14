/**
 * One-command local verification: the gate you run before pushing.
 *
 *   node scripts/verify.mjs
 *
 * Runs, in order, and stops at the first failure:
 *   1. clean     — remove lib/ and .build/
 *   2. typecheck — tsc --noEmit for src and tests
 *   3. test      — vitest (state machine, synth, engine, settings, manifest)
 *   4. build     — tsc emit + tsdown client bundle
 *
 * Optional extra step (needs the dsh CLI on PATH): pass --install to also run
 * `dsh plugin --profile web add link:.` then verify the composed config tree,
 * and `--uninstall` to remove it again.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const steps = [
  { name: 'clean', command: 'node', args: ['scripts/clean.mjs'] },
  { name: 'typecheck:src', command: 'node', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json', '--noEmit'] },
  { name: 'typecheck:tests', command: 'node', args: ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--noEmit'] },
  { name: 'test', command: 'node', args: ['node_modules/vitest/vitest.mjs', 'run', 'tests'] },
  { name: 'build', command: 'node', args: ['scripts/build.mjs'] },
]

const t0 = Date.now()
for (const step of steps) {
  process.stdout.write(`\n▶ ${step.name}\n`)
  const result = spawnSync(step.command, step.args, { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    process.stderr.write(`\n✖ verify failed at step "${step.name}" (exit ${result.status ?? 'signal'})\n`)
    process.exit(1)
  }
}

if (process.argv.includes('--install')) {
  const pkg = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(resolve(root, 'package.json'), 'utf8')))
  process.stdout.write(`\n▶ install link into profile (${pkg.name})\n`)
  const install = spawnSync('dsh', ['plugin', '--profile', 'web', 'add', 'link:.'],
    { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (install.status !== 0) {
    process.stderr.write('\n✖ verify failed at install\n')
    process.exit(1)
  }
  const dump = spawnSync('dsh', ['web', '--dump-config'], { cwd: root, stdio: 'pipe', shell: process.platform === 'win32' })
  if (dump.status !== 0 || !String(dump.stdout).includes(`name: ${pkg.name}`)) {
    process.stderr.write(`\n✖ verify failed: ${pkg.name} not present in the composed config tree\n`)
    process.exit(1)
  }
  process.stdout.write(`\n✔ ${pkg.name} installed and present in the config tree\n`)
  if (process.argv.includes('--uninstall')) {
    spawnSync('dsh', ['plugin', '--profile', 'web', 'remove', pkg.name],
      { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  }
}

const seconds = ((Date.now() - t0) / 1000).toFixed(1)
process.stdout.write(`\n✔ verify passed in ${seconds}s${existsSync(resolve(root, 'lib/client.js')) ? ' — lib/client.js ready' : ''}\n`)
