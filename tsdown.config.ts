import type { UserConfig } from 'tsdown'

const ID = 'dsh-achievements'

/**
 * Packages the browser bundle may `require` from the shell's frozen module
 * table. Everything else imported by the client half must be bundled in
 * (never cross-import values from other plugins — the purity gate enforces).
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

/** DeepSeek packages that are safe to inline into the client bundle. */
const BUNDLED_DEEPSEEK_PACKAGES = new Set(['@deepseek-ai/schemastery', '@deepseek-ai/cosmokit'])

export default {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: false,
  clean: false,
  deps: {
    neverBundle: [...CLIENT_EXTERNALS],
    alwaysBundle: (id: string) => CLIENT_EXTERNALS.includes(id as typeof CLIENT_EXTERNALS[number]) ? undefined : true,
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: [{
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source as typeof CLIENT_EXTERNALS[number])) return null
      if (BUNDLED_DEEPSEEK_PACKAGES.has(source)) return null
      throw new Error(`client bundle purity: ${JSON.stringify(source)} is not an allowed platform or bundled library`)
    },
  }],
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
} satisfies UserConfig
