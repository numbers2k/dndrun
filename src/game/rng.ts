/** Внутренняя энтропия вылазки — игроку не показывается и не шарится. */
export function createSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let seed = ''
  for (let i = 0; i < 12; i += 1) {
    seed += chars[Math.floor(Math.random() * chars.length)]
  }
  return seed
}

export function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class SeededRng {
  private state: number

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed)
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min
  }

  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)]
  }

  shuffle<T>(items: T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i)
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
  }
}
