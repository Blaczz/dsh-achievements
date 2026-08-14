import { existsSync, lstatSync, mkdirSync, readlinkSync, symlinkSync, unlinkSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'

const root = process.cwd()
const installedRoot = process.env.DSH_NODE_MODULES === undefined
  ? undefined
  : resolve(process.env.DSH_NODE_MODULES)
const workspaceRoot = resolve(process.env.DSH_WORKSPACE_ROOT ?? '../dsh-workspace')
const links = {
  '@deepseek-ai/cordis': 'vendor/cordis',
  '@deepseek-ai/schemastery': 'vendor/schemastery',
  '@deepseek-ai/dsh-settings': 'packages/settings/settings',
  '@deepseek-ai/dsh-host-webserver': 'packages/host/webserver',
  '@deepseek-ai/dsh-home-paths': 'packages/host/home-paths',
  '@deepseek-ai/dsh-session': 'packages/session/session',
  '@deepseek-ai/dsh-tools': 'packages/core/tools',
  '@deepseek-ai/dsh-client-runtime': 'packages/client/runtime',
  '@deepseek-ai/dsh-client-ui-settings': 'packages/client/ui-settings',
  '@deepseek-ai/dsh-client-ui-primitives': 'packages/client/ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots': 'packages/client/ui-slots',
}

if (installedRoot !== undefined && !existsSync(installedRoot)) {
  throw new Error(`DSH node_modules does not exist: ${installedRoot}. Set DSH_NODE_MODULES to an installed DSH runtime.`)
}
if (installedRoot === undefined && !existsSync(workspaceRoot)) {
  throw new Error(`DSH workspace does not exist: ${workspaceRoot}. Set DSH_WORKSPACE_ROOT to a local DSH workspace.`)
}

for (const [packageName, workspacePath] of Object.entries(links)) {
  const target = installedRoot === undefined
    ? resolve(workspaceRoot, workspacePath)
    : resolve(installedRoot, packageName)
  const destination = resolve(root, 'node_modules', packageName)
  if (!existsSync(target)) throw new Error(`DSH package source does not exist: ${target}`)
  ensureLink(destination, target)
}

function ensureLink(destination, target) {
  mkdirSync(dirname(destination), { recursive: true })
  if (pathExists(destination)) {
    if (lstatSync(destination).isSymbolicLink()) {
      const current = resolve(dirname(destination), readlinkSync(destination))
      if (current === target) return
      unlinkSync(destination)
    } else {
      throw new Error(`Refusing to replace existing dependency: ${destination}`)
    }
  }
  symlinkSync(process.platform === 'win32' ? target : relative(dirname(destination), target), destination,
    process.platform === 'win32' ? 'junction' : 'dir')
}

function pathExists(path) {
  try {
    lstatSync(path)
    return true
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return false
    throw error
  }
}
