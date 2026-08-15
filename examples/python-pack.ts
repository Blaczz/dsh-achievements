/**
 * Example Achievement Pack — a minimal, self-contained third-party pack.
 *
 * Copy this file into your Host plugin, adjust the ids (they must be globally
 * unique), then register it in your `apply`:
 *
 *   import { PYTHON_PACK } from './python-pack'
 *   export const inject = ['achievements']
 *   export function apply(ctx) { ctx.achievements.registerPack(PYTHON_PACK) }
 *
 * See docs/SDK.md for the full author guide.
 */
import type { AchievementPack } from '@deepseek-ai/dsh-achievements'

export const PYTHON_PACK: AchievementPack = {
  id: 'python',
  version: '0.1.0',
  name: { zh: 'Python', en: 'Python' },
  achievements: [
    {
      id: 'python-explorer',
      icon: '🐍',
      title: { zh: 'Python 探索者', en: 'Python Explorer' },
      description: { zh: '读 5 个 .py 文件', en: 'Read 5 .py files' },
      flavorText: { zh: 'import this', en: 'import this' },
      rarity: 'uncommon',
      xp: 30,
      scope: 'session',
      evaluate: ctx => {
        const count = Object.keys(ctx.session.filesRead).filter(path => path.endsWith('.py')).length
        return { unlocked: count >= 5, progress: count, target: 5 }
      },
    },
    {
      id: 'python-runner',
      icon: '🟨',
      title: { zh: 'Python 跑者', en: 'Python Runner' },
      description: { zh: '本会话运行 10 次 Python 命令', en: 'Run Python 10 times this session' },
      rarity: 'rare',
      xp: 60,
      scope: 'session',
      evaluate: ctx => {
        const runs = Object.entries(ctx.session.commands)
          .filter(([command]) => /\bpython3?\b/.test(command))
          .reduce((sum, [, count]) => sum + count, 0)
        return { unlocked: runs >= 10, progress: runs, target: 10 }
      },
    },
  ],
}
