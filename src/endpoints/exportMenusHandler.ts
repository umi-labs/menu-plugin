import type { PayloadHandler } from 'payload'

export const exportMenusHandler: PayloadHandler = async (req) => {
  const { payload } = req

  const result = await payload.find({
    collection: 'menus',
    limit: 0,
    pagination: false,
  })

  return new Response(JSON.stringify(result.docs, null, 2), {
    headers: {
      'Content-Disposition': 'attachment; filename="menus-export.json"',
      'Content-Type': 'application/json',
    },
  })
}
