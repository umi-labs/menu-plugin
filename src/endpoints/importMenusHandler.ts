import type { PayloadHandler } from 'payload'

import { normalizeMenuLocale } from '../utilities/menuIdentity.js'
import { requireAdminUser } from '../utilities/requireAdminUser.js'

type ImportMenusHandlerOptions = {
  requireAdmin?: boolean
}

export const createImportMenusHandler =
  ({ requireAdmin = true }: ImportMenusHandlerOptions = {}): PayloadHandler =>
  async (req) => {
    const { payload } = req

    if (requireAdmin) {
      const authError = requireAdminUser(req)
      if (authError) return authError
    }

    let menus: any[]
    try {
      const body = await req.json?.()
      menus = Array.isArray(body) ? body : body?.menus
      if (!Array.isArray(menus)) {
        return Response.json(
          { error: 'Request body must be a JSON array of menus or { menus: [...] }' },
          { status: 400 },
        )
      }
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const results: { created: number; errors: string[]; updated: number } = {
      created: 0,
      errors: [],
      updated: 0,
    }

    for (const menu of menus) {
      try {
        const { id: _id, createdAt: _ca, updatedAt: _ua, slugLocaleKey: _slugLocaleKey, ...data } = menu
        const normalizedLocale = normalizeMenuLocale(data.locale)

        if (!data.slug || !data.title) {
          results.errors.push(`Skipped menu: missing slug or title`)
          continue
        }

        const where: Record<string, any> = {
          slug: { equals: data.slug },
        }

        if (normalizedLocale) {
          where.locale = { equals: normalizedLocale }
        } else {
          where.or = [
            { locale: { exists: false } },
            { locale: { equals: '' } },
            { locale: { equals: null } },
          ]
        }

        const existing = await payload.find({
          collection: 'menus',
          limit: 1,
          where,
        })

        const menuData = {
          ...data,
          locale: normalizedLocale,
        }

        if (existing.docs.length > 0) {
          await payload.update({
            id: existing.docs[0].id,
            collection: 'menus',
            data: menuData,
          })
          results.updated++
        } else {
          await payload.create({
            collection: 'menus',
            data: menuData,
          })
          results.created++
        }
      } catch (err: any) {
        results.errors.push(`Failed to import menu '${menu.slug}': ${err.message}`)
      }
    }

    return Response.json(results)
  }

export const importMenusHandler = createImportMenusHandler()
