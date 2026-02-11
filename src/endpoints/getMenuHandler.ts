import type { PayloadHandler } from 'payload'

import { menuCache } from '../cache.js'

export const getMenuHandler: PayloadHandler = async (req) => {
  const { payload, routeParams } = req
  const slug = routeParams?.slug as string | undefined

  if (!slug) {
    return Response.json({ error: 'Menu slug is required' }, { status: 400 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  const locale = url.searchParams.get('locale') || undefined
  const depth = parseInt(url.searchParams.get('depth') || '0', 10)

  // Check cache first
  const cached = menuCache.get(slug, locale)
  if (cached) {
    return Response.json(cached)
  }

  const where: Record<string, any> = {
    slug: { equals: slug },
  }

  if (locale) {
    where.locale = { equals: locale }
  }

  const result = await payload.find({
    collection: 'menus',
    depth,
    limit: 1,
    where,
  })

  if (result.docs.length === 0) {
    return Response.json({ error: `Menu '${slug}' not found` }, { status: 404 })
  }

  const menu = result.docs[0]
  menuCache.set(slug, menu, locale)

  return Response.json(menu)
}
