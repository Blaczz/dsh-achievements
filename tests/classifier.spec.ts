/** Event classifier fixtures: raw tool name + args → standardized behavior projection. */
import { describe, expect, it } from 'vitest'
import { classifyTool, isDependencyPath, isTestCommand, parseToolArguments } from '../src/events.ts'

describe('classifyTool', () => {
  it('classifies read → file-read with path', () => {
    expect(classifyTool('read', { file_path: 'src/a.ts' })).toEqual({ kind: 'file-read', name: 'read', path: 'src/a.ts' })
  })

  it('classifies write/edit → file-edit with path', () => {
    expect(classifyTool('write', { file_path: 'a.ts', content: 'x' })).toEqual({ kind: 'file-edit', name: 'write', path: 'a.ts' })
    expect(classifyTool('edit', { file_path: 'a.ts', old_string: 'x', new_string: 'y' })).toEqual({ kind: 'file-edit', name: 'edit', path: 'a.ts' })
  })

  it('classifies bash/pwsh → shell-command with command', () => {
    expect(classifyTool('bash', { command: 'ls -la' })).toEqual({ kind: 'shell-command', name: 'bash', command: 'ls -la' })
    expect(classifyTool('pwsh', { command: 'Get-ChildItem' })).toEqual({ kind: 'shell-command', name: 'pwsh', command: 'Get-ChildItem' })
  })

  it('classifies a known test runner as test-run', () => {
    expect(classifyTool('bash', { command: 'npm test' })).toEqual({ kind: 'test-run', name: 'bash', command: 'npm test' })
    expect(classifyTool('pwsh', { command: 'vitest run' })).toEqual({ kind: 'test-run', name: 'pwsh', command: 'vitest run' })
  })

  it('falls back to other for unknown tools, missing args, or shell tools without a command', () => {
    expect(classifyTool('web_search', { query: 'x' })).toEqual({ kind: 'other', name: 'web_search' })
    expect(classifyTool('bash', {})).toEqual({ kind: 'other', name: 'bash' })
    expect(classifyTool('grep', { pattern: 'x' })).toEqual({ kind: 'other', name: 'grep' })
  })

  it('tolerates non-object arguments', () => {
    const read = classifyTool('read', undefined)
    expect(read.kind).toBe('file-read')
    expect(read.path).toBeUndefined()
  })
})

describe('isTestCommand', () => {
  it('detects common test runner invocations', () => {
    const tests = [
      'npm test', 'npm run test', 'yarn test', 'pnpm test', 'pnpm run test',
      'vitest run', 'jest', 'pytest -q', 'python -m pytest', 'cargo test',
      'go test ./...', 'dotnet test', 'mvn test', 'gradle test', './gradlew test',
    ]
    for (const command of tests) expect(isTestCommand(command), command).toBe(true)
  })

  it('rejects ordinary shell commands (including a bare "test" word)', () => {
    const commands = ['ls -la', 'git status', 'echo "test"', 'npm install', 'cat file.txt', 'bash script.sh']
    for (const command of commands) expect(isTestCommand(command), command).toBe(false)
  })
})

describe('isDependencyPath', () => {
  it('matches files under node_modules, site-packages and vendor', () => {
    const paths = [
      'node_modules/react/index.js',
      'src/node_modules/dep/a.ts',
      './vendor/autoload.php',
      'site-packages/django/apps.py',
    ]
    for (const path of paths) expect(isDependencyPath(path), path).toBe(true)
  })

  it('normalizes Windows backslashes', () => {
    expect(isDependencyPath('C:\\proj\\node_modules\\a.js')).toBe(true)
    expect(isDependencyPath('C:\\proj\\src\\a.js')).toBe(false)
  })

  it('rejects ordinary source paths and lookalike names', () => {
    const paths = ['src/index.ts', 'vendor-scripts/build.sh', '', 'node_modulesx/a.ts']
    for (const path of paths) expect(isDependencyPath(path), path).toBe(false)
  })
})

describe('parseToolArguments', () => {
  it('parses valid JSON and tolerates garbage without throwing', () => {
    expect(parseToolArguments('{"file_path":"a.ts"}')).toEqual({ file_path: 'a.ts' })
    expect(parseToolArguments('not json')).toBeUndefined()
    expect(parseToolArguments('')).toBeUndefined()
  })
})
