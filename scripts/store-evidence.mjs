/**
 * Disposable-profile store evidence for dsh-achievements.
 *
 * Boots an ISOLATED DSH profile (fresh $DSH_HOME under the OS temp dir)
 * with a pinned official @deepseek-ai/dsh CLI version, installs this plugin
 * from its packed tarball, dumps the composed config, boots the web app
 * headless until it listens, then removes the plugin and the profile.
 *
 * Evidence (install / start / uninstall) is printed to stdout; the repo
 * records a captured run in docs/store-evidence-<version>.md.
 *
 * Usage:
 *   node scripts/store-evidence.mjs <dshVersion>
 *   e.g. node scripts/store-evidence.mjs 0.1.5-alpha.1
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const dshVersion = process.argv[2]
if (!dshVersion) {
  console.error('usage: node scripts/store-evidence.mjs <dshVersion>')
  process.exit(1)
}
const tarball = join(root, `dsh-achievements-${pkgVersion()}.tgz`)
const profile = 'store-evidence'
const dshHome = mkdtempSync(join(tmpdir(), 'dsh-store-evidence-'))
const log = (msg) => console.log(`\n[evidence] ${msg}`)

function pkgVersion() {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
}

function mkdirRecursive(dir) {
  mkdirSync(dir, { recursive: true })
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    timeout: 420_000,
    ...opts,
  })
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed: ${result.stderr ?? ''}${result.stdout ?? ''}`)
  }
  return result.stdout ?? ''
}

function dsh(args) {
  return run('npx', ['-y', `@deepseek-ai/dsh@${dshVersion}`, ...args], {
    env: { ...process.env, DSH_HOME: dshHome },
  })
}

const steps = {
  pack() {
    log('npm pack')
    // Always repack: a stale tarball from an earlier lib would otherwise be
    // installed instead of the current sources.
    run('npm', ['pack', '--ignore-scripts'], { cwd: root })
  },
  bootstrap() {
    log(`bootstrap disposable profile with @deepseek-ai/dsh-web-app@${dshVersion}`)
    // Pre-create the profile skeleton so the first pnpm run already carries the
    // native-build approval (pnpm 11 refuses ignored build scripts otherwise,
    // and the approval must exist before the very first install).
    const profileDir = join(dshHome, 'profiles', profile)
    mkdirRecursive(profileDir)
    writeFileSync(join(profileDir, 'package.json'), '{}\n')
    writeFileSync(join(profileDir, 'pnpm-workspace.yaml'),
      'packages:\n  - .\nnodeLinker: hoisted\n' +
      'autoInstallPeers: false\n' +
      'dangerouslyAllowAllBuilds: true\n')
    dsh(['plugin', '--profile', profile, 'add', `@deepseek-ai/dsh-base@${dshVersion}`])
    dsh(['plugin', '--profile', profile, 'add', `@deepseek-ai/dsh-web-app@${dshVersion}`])
  },
  install() {
    log('install plugin tarball')
    dsh(['plugin', '--profile', profile, 'add', tarball])
  },
  dump() {
    log('composed config')
    const cfg = dsh(['--profile', profile, '--dump-config'])
    if (!cfg.includes('dsh-achievements')) throw new Error('plugin absent from composed config')
    console.log(cfg.split('\n').filter((l) => l.includes('dsh-achievements')).join('\n'))
  },
  async start() {
    log(`boot web headless on dsh@${dshVersion}`)
    const port = 0
    // spawn in background, wait for a listening log line, then terminate
    const child = spawn('npx', ['-y', `@deepseek-ai/dsh@${dshVersion}`, '--profile', profile, '--port', String(port)], {
      env: { ...process.env, DSH_HOME: dshHome },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = ''
    const err = []
    child.stdout.on('data', (c) => { out += c })
    child.stderr.on('data', (c) => { err.push(String(c)) })
    const ok = await new Promise((resolvePromise) => {
      const timer = setTimeout(() => resolvePromise(false), 60_000)
      const poll = setInterval(() => {
        if (/listening|listen|http:\/\//i.test(out) || /error|failed|throw/i.test(err.join(''))) {
          clearTimeout(timer); clearInterval(poll); resolvePromise(true)
        }
      }, 250)
      child.on('exit', (code) => { clearTimeout(timer); clearInterval(poll); resolvePromise(code === 0) })
    })
    console.log(out.split('\n').filter((l) => /achievement|listen|listening|http:|error|ready|serving/i.test(l)).slice(-20).join('\n'))
    child.kill()
    if (!ok) {
      const combined = (out + '\n' + err.join('\n')).split('\n').filter((l) => l.trim() !== '').slice(-40).join('\n')
      throw new Error(`web boot did not reach a listening state. Captured output:\n${combined}`)
    }
  },
  uninstall() {
    log('uninstall plugin + remove disposable profile')
    dsh(['plugin', '--profile', profile, 'remove', 'dsh-achievements'])
    rmSync(join(dshHome, 'profiles', profile), { recursive: true, force: true })
  },
}

try {
  steps.pack()
  steps.bootstrap()
  steps.install()
  steps.dump()
  await steps.start()
  steps.uninstall()
  log(`OK: install/start/uninstall passed on @deepseek-ai/dsh@${dshVersion}`)
} catch (error) {
  console.error(`[evidence] FAILED: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
} finally {
  rmSync(dshHome, { recursive: true, force: true })
}
