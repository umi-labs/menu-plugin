import { normalizeMenuLocale } from './utilities/menuIdentity.js'

export type MenuDocument = {
  id?: string
  items?: unknown[]
  locale?: null | string
  slug: string
  [key: string]: unknown
}

export type FetchMenuOptions = {
  apiRoute?: string
  baseURL?: string
  depth?: number
  fetch?: typeof globalThis.fetch
  locale?: string
  slug: string
}

export const buildMenuRequestURL = ({
  apiRoute = '/api',
  baseURL,
  depth = 0,
  locale,
  slug,
}: Omit<FetchMenuOptions, 'fetch'>): string => {
  const params = new URLSearchParams()
  const normalizedLocale = normalizeMenuLocale(locale)

  if (normalizedLocale) params.set('locale', normalizedLocale)
  if (depth) params.set('depth', String(depth))

  const query = params.toString()
  const normalizedApiRoute = apiRoute.startsWith('/') ? apiRoute : `/${apiRoute}`
  const pathname = `${normalizedApiRoute}/menus/${slug}${query ? `?${query}` : ''}`

  return baseURL ? new URL(pathname, baseURL).toString() : pathname
}

export const fetchMenu = async ({
  fetch: fetchImpl = globalThis.fetch,
  ...options
}: FetchMenuOptions): Promise<MenuDocument> => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required to fetch menus in this environment')
  }

  const response = await fetchImpl(buildMenuRequestURL(options))

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || `Failed to fetch menu: ${response.status}`)
  }

  return (await response.json()) as MenuDocument
}
