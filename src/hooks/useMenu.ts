'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchMenu as requestMenu, type FetchMenuOptions, type MenuDocument } from '../fetchMenu.js'
import { normalizeMenuLocale } from '../utilities/menuIdentity.js'

type UseMenuOptions = Omit<FetchMenuOptions, 'fetch'> & {
  fetch?: typeof globalThis.fetch
}

type UseMenuResult = {
  error: null | string
  isLoading: boolean
  menu: MenuDocument | null
  refetch: () => Promise<void>
}

type ClientCacheEntry = {
  data: MenuDocument
  timestamp: number
}

const clientCache = new Map<string, ClientCacheEntry>()
const CACHE_TTL = 30_000

const getDefaultBaseURL = (): string | undefined => {
  if (typeof window === 'undefined') return undefined
  return window.location.origin
}

const getCacheKey = ({ apiRoute = '/api', baseURL, depth = 0, locale, slug }: UseMenuOptions): string => {
  return JSON.stringify({
    apiRoute,
    baseURL: baseURL || getDefaultBaseURL(),
    depth,
    locale: normalizeMenuLocale(locale),
    slug,
  })
}

export const useMenu = ({
  apiRoute = '/api',
  baseURL,
  depth = 0,
  fetch: fetchImpl,
  locale,
  slug,
}: UseMenuOptions): UseMenuResult => {
  const [menu, setMenu] = useState<MenuDocument | null>(null)
  const [error, setError] = useState<null | string>(null)
  const [isLoading, setIsLoading] = useState(true)
  const abortRef = useRef<AbortController | null>(null)

  const cacheKey = getCacheKey({ apiRoute, baseURL, depth, locale, slug })

  const fetchMenu = useCallback(async () => {
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
      const data = await requestMenu({
        apiRoute,
        baseURL: baseURL || getDefaultBaseURL(),
        depth,
        fetch: async (input, init) =>
          (fetchImpl || globalThis.fetch)(input, {
            ...init,
            signal: controller.signal,
          }),
        locale,
        slug,
      })

      clientCache.set(cacheKey, { data, timestamp: Date.now() })
      setMenu(data)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message)
      }
    } finally {
      setIsLoading(false)
    }
  }, [apiRoute, baseURL, cacheKey, depth, fetchImpl, locale, slug])

  useEffect(() => {
    void fetchMenu()
    return () => {
      abortRef.current?.abort()
    }
  }, [fetchMenu])

  return { error, isLoading, menu, refetch: fetchMenu }
}
