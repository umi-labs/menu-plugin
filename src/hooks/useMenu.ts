'use client'

import { useConfig } from '@payloadcms/ui'
import { useCallback, useEffect, useRef, useState } from 'react'

type UseMenuOptions = {
  depth?: number
  locale?: string
  slug: string
}

type UseMenuResult = {
  error: null | string
  isLoading: boolean
  menu: any | null
  refetch: () => Promise<void>
}

const clientCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 30_000

export const useMenu = ({ slug, depth = 0, locale }: UseMenuOptions): UseMenuResult => {
  const { config } = useConfig()
  const [menu, setMenu] = useState<any | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const cacheKey = `${slug}:${locale || ''}:${depth}`

  const fetchMenu = useCallback(async () => {
    // Check client-side cache
    const cached = clientCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setMenu(cached.data)
      setIsLoading(false)
      setError(null)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (locale) params.set('locale', locale)
      if (depth) params.set('depth', String(depth))
      const query = params.toString()

      const apiRoute = config.routes?.api || '/api'
      const url = `${apiRoute}/menus/${slug}${query ? `?${query}` : ''}`

      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Failed to fetch menu: ${response.status}`)
      }

      const data = await response.json()
      clientCache.set(cacheKey, { data, timestamp: Date.now() })
      setMenu(data)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey, config.routes?.api, depth, locale, slug])

  useEffect(() => {
    void fetchMenu()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchMenu])

  return { error, isLoading, menu, refetch: fetchMenu }
}
