import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const stagingRoot = resolve(root, '.build')
const stagingLib = resolve(stagingRoot, 'lib')
const backupLib = resolve(stagingRoot, 'lib.previous')
const currentLib = resolve(root, 'lib')

rmSync(stagingRoot, { recursive: true, force: true })
mkdirSync(stagingRoot, { recursive: true })

try {
  run('node', [
    'node_modules/typescript/bin/tsc',
    '-p', 'tsconfig.json',
    '--outDir', stagingLib,
    '--declarationDir', resolve(stagingLib, 'types'),
  ])
  run('node', ['node_modules/tsdown/dist/run.mjs', '--config', 'tsdown.config.ts', '--out-dir', stagingLib])
  sanitizeClient(stagingLib)
  promote(stagingLib, currentLib, backupLib)
} finally {
  rmSync(stagingRoot, { recursive: true, force: true })
}

/** Remove build-machine paths from the bundled client so the artifact is portable. */
function sanitizeClient(lib) {
  const needles = [root, root.replaceAll('\\', '/')]
  const dependencyRoot = resolve(realpathSync(resolve(root, 'node_modules/@deepseek-ai/schemastery')), '../..')
  const dependencyNeedles = [
    `${dependencyRoot.replaceAll('\\', '/')}/`,
    `${relative(root, dependencyRoot).replaceAll('\\', '/')}/`,
    `${relative(lib, dependencyRoot).replaceAll('\\', '/')}/`,
  ]
  for (const name of ['client.js', 'client.js.map']) {
    const path = resolve(lib, name)
    if (!existsSync(path)) continue
    let text = readFileSync(path, 'utf8')
    for (const needle of needles) text = text.replaceAll(needle, '<package-root>')
    for (const needle of dependencyNeedles) text = text.replaceAll(needle, 'node_modules/')
    if (needles.some(needle => text.includes(needle))
      || dependencyNeedles.some(needle => text.includes(needle))) {
      throw new Error(`${name} still contains a build-machine path after sanitization`)
    }
    writeFileSync(path, text)
  }
}

function promote(source, destination, backup) {
  if (!existsSync(destination)) {
    renameSync(source, destination)
    return
  }
  // Portable swap: rename current aside, promote staging, drop the old copy.
  renameSync(destination, backup)
  try {
    renameSync(source, destination)
    rmSync(backup, { recursive: true, force: true })
  } catch (error) {
    if (!existsSync(destination) && existsSync(backup)) renameSync(backup, destination)
    throw error
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', cwd: root })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} exited with status ${result.status ?? 'signal'}`)
}
