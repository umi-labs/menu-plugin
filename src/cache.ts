type CacheEntry = {
  data: any
  expiresAt: number
}

export class MenuCache {
  private cache = new Map<string, CacheEntry>()
  private ttl: number

  constructor(ttlMs = 60_000) {
    this.ttl = ttlMs
  }

  configure(ttlMs: number): void {
    this.ttl = ttlMs
  }

  private buildKey(slug: string, depth = 0, locale?: string): string {
    return `${slug}::${locale || '__default'}::${depth}`
  }

  clear(): void {
    this.cache.clear()
  }

  get(slug: string, depth = 0, locale?: string): any | undefined {
    const key = this.buildKey(slug, depth, locale)
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    return entry.data
  }

  invalidate(slug: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${slug}::`)) {
        this.cache.delete(key)
      }
    }
  }

  set(slug: string, data: any, depth = 0, locale?: string): void {
    const key = this.buildKey(slug, depth, locale)
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    })
  }
}

export const menuCache = new MenuCache()
