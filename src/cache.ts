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

  private buildKey(slug: string, locale?: string): string {
    return locale ? `${slug}:${locale}` : slug
  }

  clear(): void {
    this.cache.clear()
  }

  get(slug: string, locale?: string): any | undefined {
    const key = this.buildKey(slug, locale)
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return undefined
    }
    return entry.data
  }

  invalidate(slug: string, locale?: string): void {
    if (locale) {
      this.cache.delete(this.buildKey(slug, locale))
    } else {
      // Invalidate all locales for this slug
      for (const key of this.cache.keys()) {
        if (key === slug || key.startsWith(`${slug}:`)) {
          this.cache.delete(key)
        }
      }
    }
  }

  set(slug: string, data: any, locale?: string): void {
    const key = this.buildKey(slug, locale)
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttl,
    })
  }
}

export const menuCache = new MenuCache()
