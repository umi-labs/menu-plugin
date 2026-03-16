import type { PayloadHandler } from 'payload'

import { menuCache } from '../cache.js'
import { normalizeMenuLocale } from '../utilities/menuIdentity.js'
import { sanitizeMenuDocument } from '../utilities/sanitizeMenuDocument.js'

type GetMenuHandlerOptions = {
  cache?: typeof menuCache
}

export const createGetMenuHandler = ({ cache = menuCache }: GetMenuHandlerOptions = {}): PayloadHandler =>
  async (req) => {
    const { payload, routeParams } = req
    const slug = routeParams?.slug as string | undefined

    if (!slug) {
      return Response.json({ error: 'Menu slug is required' }, { status: 400 })
    }

    const url = new URL(req.url || '', 'http://localhost')
    const locale = normalizeMenuLocale(url.searchParams.get('locale') || undefined)
    const depth = Number.parseInt(url.searchParams.get('depth') || '0', 10)
    const safeDepth = Number.isNaN(depth) ? 0 : depth

    const cached = cache.get(slug, safeDepth, locale)
    if (cached) {
      return Response.json(cached)
    }

    const where: Record<string, any> = {
      slug: { equals: slug },
    }

    if (locale) {
      where.locale = { equals: locale }
    } else {
      where.or = [{ locale: { exists: false } }, { locale: { equals: '' } }, { locale: { equals: null } }]
    }

    const result = await payload.find({
      collection: 'menus',
      depth: safeDepth,
      limit: 1,
      where,
    })

    if (result.docs.length === 0) {
      return Response.json({ error: `Menu '${slug}' not found` }, { status: 404 })
    }

    const menu = sanitizeMenuDocument(result.docs[0] as Record<string, unknown>)
    cache.set(slug, menu, safeDepth, locale)

    return Response.json(menu)
  }

export const getMenuHandler = createGetMenuHandler()
