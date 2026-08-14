/**
 * Unlock toast: a zero-dependency, self-removing DOM notification. Queued so
 * several unlocks in one refresh stack instead of overlapping.
 */
import type { AchievementView } from '../achievements.ts'

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
  const el = document.createElement('div')
  el.setAttribute('data-achievement-toast', '')
  const style = el.style
  style.position = 'fixed'
  style.right = '20px'
  style.bottom = '20px'
  style.zIndex = '2147483000'
  style.maxWidth = '320px'
  style.padding = '12px 16px'
  style.borderRadius = '12px'
  style.boxShadow = '0 8px 30px rgba(0,0,0,0.25)'
  style.background = 'rgba(30,32,40,0.96)'
  style.color = '#fff'
  style.fontFamily = 'system-ui, -apple-system, sans-serif'
  style.display = 'flex'
  style.gap = '12px'
  style.alignItems = 'center'
  style.animation = 'dsh-achievement-slide 220ms ease-out'

  const icon = document.createElement('div')
  icon.textContent = item.achievement.icon
  icon.style.fontSize = '28px'

  const body = document.createElement('div')
  body.style.flex = '1'
  const title = document.createElement('div')
  title.textContent = `🏆 成就解锁 · ${item.achievement.title.zh}`
  title.style.fontWeight = '700'
  title.style.fontSize = '14px'
  const desc = document.createElement('div')
  desc.textContent = item.achievement.description.zh + (item.elapsed === null ? '' : ` · ${item.elapsed}`)
  desc.style.fontSize = '12px'
  desc.style.opacity = '0.8'
  desc.style.marginTop = '2px'
  body.appendChild(title)
  body.appendChild(desc)

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
