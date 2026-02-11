import type { PayloadHandler } from 'payload'

export const importMenusHandler: PayloadHandler = async (req) => {
  const { payload } = req

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
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...data } = menu

      if (!data.slug || !data.title) {
        results.errors.push(`Skipped menu: missing slug or title`)
        continue
      }

      const existing = await payload.find({
        collection: 'menus',
        limit: 1,
        where: { slug: { equals: data.slug } },
      })

      if (existing.docs.length > 0) {
        await payload.update({
          id: existing.docs[0].id,
          collection: 'menus',
          data,
        })
        results.updated++
      } else {
        await payload.create({
          collection: 'menus',
          data,
        })
        results.created++
      }
    } catch (err: any) {
      results.errors.push(`Failed to import menu '${menu.slug}': ${err.message}`)
    }
  }

  return Response.json(results)
}
