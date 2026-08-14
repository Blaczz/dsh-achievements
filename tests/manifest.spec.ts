/** Manifest contract tests: the package must satisfy the DSH bundle + client contracts. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { load as parseYaml } from 'js-yaml'
import rawPkg from '../package.json' with { type: 'json' }

const ROOT = resolve(import.meta.dirname, '..')

interface PackageManifest {
  name: string
  files: string[]
  exports?: Record<string, { types?: string; default?: string } | string>
  dsh?: {
    bundle?: { patch?: string }
    client?: { platform?: string; inject?: string[] }
  }
}

const pkg = rawPkg as PackageManifest

describe('package manifest', () => {
  it('declares the bundle patch', () => {
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  })

  it('declares the web client half', () => {
    expect(pkg.dsh?.client?.platform).toBe('web')
    expect(pkg.dsh?.client?.inject).toContain('@deepseek-ai/dsh-client-runtime')
  })

  it('exports the client bundle and the patch', () => {
    const clientExport = pkg.exports?.['./client']
    expect(typeof clientExport === 'object' && clientExport !== null ? clientExport.default : clientExport)
      .toBe('./lib/client.js')
    expect(pkg.exports?.['./cordis.patch.yml']).toBe('./cordis.patch.yml')
  })

  it('files list covers the runtime artifacts', () => {
    for (const file of ['lib', 'cordis.patch.yml', 'README.md', 'LICENSE']) {
      expect(pkg.files).toContain(file)
    }
  })
})

describe('cordis.patch.yml', () => {
  const patch = parseYaml(readFileSync(resolve(ROOT, 'cordis.patch.yml'), 'utf8')) as unknown

  it('is a top-level array with one insert entry pointing at this package', () => {
    expect(Array.isArray(patch)).toBe(true)
    const entry = (patch as Array<{ insert?: Array<{ id?: string; name?: string }> }>)[0]
    expect(entry?.insert?.[0]?.id).toBe('achievements')
    expect(entry?.insert?.[0]?.name).toBe(pkg.name)
  })
})
