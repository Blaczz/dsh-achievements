/**
 * Unlock toast: a zero-dependency, self-removing DOM notification. Queued so
 * several unlocks in one refresh stack instead of overlapping. Steam-like:
 * a rarity accent + rarity label, title, description, flavor text, and +XP.
 */
import type { AchievementView } from '../achievements.ts'
import { RARITY_META } from '../gamification.ts'

interface ToastItem {
  achievement: AchievementView
  elapsed: string | null
}

let activeToast: HTMLDivElement | null = null
const queue: ToastItem[] = []

/** Show one unlock toast; multiple calls stack into a queue. */
export function showUnlockToast(achievement: AchievementView, elapsed: string | null): void {
  queue.push({ achievement, elapsed })
  drainQueue()
}

function drainQueue(): void {
  if (activeToast !== null || queue.length === 0) return
  const item = queue.shift()
  if (item === undefined) return
  activeToast = buildToast(item)
  document.body.appendChild(activeToast)
  const remove = (): void => {
    if (activeToast !== null) {
      activeToast.remove()
      activeToast = null
    }
    if (queue.length > 0) window.setTimeout(drainQueue, 150)
  }
  window.setTimeout(remove, 4200)
}

function buildToast(item: ToastItem): HTMLDivElement {
  const { achievement, elapsed } = item
  const rarity = RARITY_META[achievement.rarity]

  const el = document.createElement('div')
  el.setAttribute('data-achievement-toast', '')
  const style = el.style
  style.position = 'fixed'
  style.right = '20px'
  style.bottom = '20px'
  style.zIndex = '2147483000'
  style.maxWidth = '340px'
  style.padding = '12px 16px'
  style.borderRadius = '12px'
  style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)'
  style.background = 'rgba(30,32,40,0.96)'
  style.color = '#fff'
  style.fontFamily = 'system-ui, -apple-system, sans-serif'
  style.display = 'flex'
  style.gap = '12px'
  style.alignItems = 'flex-start'
  style.borderLeft = `4px solid ${rarity.color}`
  style.animation = 'dsh-achievement-slide 220ms ease-out'

  const icon = document.createElement('div')
  icon.textContent = achievement.icon
  icon.style.fontSize = '30px'
  icon.style.lineHeight = '1.2'

  const body = document.createElement('div')
  body.style.flex = '1'
  body.style.minWidth = '0'

  const eyebrow = document.createElement('div')
  eyebrow.textContent = `🏆 ${rarity.label.zh} · 成就解锁`
  eyebrow.style.fontSize = '11px'
  eyebrow.style.fontWeight = '700'
  eyebrow.style.letterSpacing = '0.02em'
  eyebrow.style.color = rarity.color

  const title = document.createElement('div')
  title.textContent = achievement.title.zh
  title.style.fontWeight = '700'
  title.style.fontSize = '15px'
  title.style.marginTop = '2px'

  const desc = document.createElement('div')
  desc.textContent = achievement.description.zh + (elapsed === null ? '' : ` · ${elapsed}`)
  desc.style.fontSize = '12px'
  desc.style.opacity = '0.8'
  desc.style.marginTop = '2px'

  const footer = document.createElement('div')
  footer.style.display = 'flex'
  footer.style.gap = '8px'
  footer.style.alignItems = 'center'
  footer.style.marginTop = '6px'

  const xp = document.createElement('div')
  xp.textContent = `+${achievement.xp} XP`
  xp.style.fontSize = '12px'
  xp.style.fontWeight = '700'
  xp.style.color = rarity.color

  const flavor = document.createElement('div')
  flavor.style.fontSize = '11px'
  flavor.style.fontStyle = 'italic'
  flavor.style.opacity = '0.55'
  flavor.style.flex = '1'
  flavor.style.minWidth = '0'
  flavor.style.overflow = 'hidden'
  flavor.style.textOverflow = 'ellipsis'
  flavor.style.whiteSpace = 'nowrap'
  if (achievement.flavorText !== undefined) flavor.textContent = achievement.flavorText.zh

  footer.appendChild(xp)
  footer.appendChild(flavor)

  body.appendChild(eyebrow)
  body.appendChild(title)
  body.appendChild(desc)
  body.appendChild(footer)

  el.appendChild(icon)
  el.appendChild(body)

  ensureKeyframes()
  return el
}

/** Inject the slide-in keyframes once per document. */
function ensureKeyframes(): void {
  if (document.getElementById('dsh-achievement-keyframes') !== null) return
  const style = document.createElement('style')
  style.id = 'dsh-achievement-keyframes'
  style.textContent = '@keyframes dsh-achievement-slide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }'
  document.head.appendChild(style)
}
